import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import type { SidecarHistoryReader } from '../controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../controllers/session-gateway.js'
import { buildTranscript } from '../controllers/transcript.js'
import type { SidecarTranscriptMessage } from '../controllers/transcript.js'
import { styles } from '../styles.js'

const ACTIVE_POLL_MS = 850
const IDLE_POLL_MS = 5_000

export interface ChildProjectionSurfaceProps {
  afterSeq: number
  childSessionId: string
  excerpt?: string
  gateway: SidecarSessionGateway
  history: SidecarHistoryReader
  running: boolean
}

export function ChildProjectionSurface({
  afterSeq,
  childSessionId,
  excerpt,
  gateway,
  history,
  running,
}: ChildProjectionSurfaceProps) {
  const [draft, setDraft] = useState(() => excerptDraft(excerpt))
  const [error, setError] = useState<string>()
  const [messages, setMessages] = useState<readonly SidecarTranscriptMessage[]>([])
  const [sending, setSending] = useState(false)
  const activeKey = `${childSessionId}:${afterSeq}`
  const activeKeyRef = useRef(activeKey)
  const historyRequestRef = useRef<{
    key: string
    promise: Promise<readonly SidecarTranscriptMessage[]>
  }>()
  const mountedRef = useRef(true)
  const runningRef = useRef(running)
  const sendingRef = useRef(false)
  activeKeyRef.current = activeKey
  runningRef.current = running

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const readTranscript = useCallback(() => {
    const current = historyRequestRef.current
    if (current?.key === activeKey) return current.promise

    const promise = history
      .history(childSessionId)
      .then((events) => buildTranscript(events, afterSeq))
    const request = { key: activeKey, promise }
    historyRequestRef.current = request
    void promise.then(
      () => {
        if (historyRequestRef.current === request) historyRequestRef.current = undefined
      },
      () => {
        if (historyRequestRef.current === request) historyRequestRef.current = undefined
      },
    )
    return promise
  }, [activeKey, afterSeq, childSessionId, history])

  const refresh = useCallback(async () => {
    const nextMessages = await readTranscript()
    if (mountedRef.current && activeKeyRef.current === activeKey) {
      setMessages(nextMessages)
    }
  }, [activeKey, readTranscript])

  useEffect(() => {
    let live = true
    let timer: number | undefined
    const poll = async () => {
      try {
        await refresh()
      } catch (nextError) {
        if (live) setError(nextError instanceof Error ? nextError.message : String(nextError))
      } finally {
        if (live) {
          timer = window.setTimeout(
            () => void poll(),
            runningRef.current ? ACTIVE_POLL_MS : IDLE_POLL_MS,
          )
        }
      }
    }
    void poll()
    return () => {
      live = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [refresh])

  const sendDraft = useCallback(async () => {
    const text = draft.trim()
    if (text === '' || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    setError(undefined)
    try {
      await gateway.prompt(childSessionId, text)
      setDraft('')
      await refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [childSessionId, draft, gateway, refresh])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void sendDraft()
  }

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void sendDraft()
  }

  return (
    <div className={styles.surface}>
      {excerpt === undefined ? null : (
        <blockquote className={styles.excerpt}>{excerpt}</blockquote>
      )}
      <p className={styles.contextNote}>已继承所选回答之前的上下文；下面只显示分支新增内容。</p>
      <div aria-live="polite" className={styles.transcript}>
        {messages.length === 0 ? (
          <p className={styles.empty}>输入一个针对性追问。</p>
        ) : (
          messages.map((message) => (
            <article className={styles[message.role]} key={message.id}>
              <span className={styles.role}>
                {message.role === 'user' ? '你' : message.role === 'assistant' ? 'AI' : '状态'}
              </span>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>
      {error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <form className={styles.composer} onSubmit={submit}>
        <textarea
          aria-label="侧边追问"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="继续追问…（Enter 发送，Shift+Enter 换行）"
          rows={3}
          value={draft}
        />
        <div className={styles.actions}>
          {running ? (
            <button
              onClick={() => void gateway.cancel(childSessionId).catch(() => undefined)}
              type="button"
            >
              停止
            </button>
          ) : null}
          <button disabled={sending || draft.trim() === ''} type="submit">
            {sending ? '发送中…' : '发送'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function excerptDraft(excerpt: string | undefined): string {
  if (excerpt === undefined) return ''
  const quoted = excerpt
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return `针对以下选中片段：\n\n${quoted}\n\n`
}
