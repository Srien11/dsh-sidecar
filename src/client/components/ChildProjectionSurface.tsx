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

export interface ChildProjectionSurfaceProps {
  afterSeq: number
  childSessionId: string
  gateway: SidecarSessionGateway
  history: SidecarHistoryReader
  running: boolean
}

export function ChildProjectionSurface({
  afterSeq,
  childSessionId,
  gateway,
  history,
  running,
}: ChildProjectionSurfaceProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string>()
  const [messages, setMessages] = useState<readonly SidecarTranscriptMessage[]>([])
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)

  const refresh = useCallback(async () => {
    const events = await history.history(childSessionId)
    setMessages(buildTranscript(events, afterSeq))
  }, [afterSeq, childSessionId, history])

  useEffect(() => {
    let live = true
    const poll = () => {
      void refresh().catch((nextError) => {
        if (live) setError(nextError instanceof Error ? nextError.message : String(nextError))
      })
    }
    poll()
    const timer = window.setInterval(poll, 850)
    return () => {
      live = false
      window.clearInterval(timer)
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
