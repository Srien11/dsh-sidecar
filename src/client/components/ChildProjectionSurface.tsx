import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'

import type { SidecarHistoryReader } from '../controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../controllers/session-gateway.js'
import { buildTranscript } from '../controllers/transcript.js'
import type { SidecarTranscriptMessage } from '../controllers/transcript.js'
import type { SidecarTranslate } from '../locales.js'
import { styles } from '../styles.js'

const ACTIVE_POLL_MS = 250
const IDLE_POLL_MS = 5_000

interface HistoryProjection {
  latestTurnEndSeq: number
  messages: readonly SidecarTranscriptMessage[]
}

export interface ChildProjectionSurfaceProps {
  afterSeq: number
  childSessionId?: string
  excerpt?: string
  gateway: SidecarSessionGateway
  history: SidecarHistoryReader
  prompt?: (text: string) => Promise<void>
  running: boolean
  t: SidecarTranslate
}

export function ChildProjectionSurface({
  afterSeq,
  childSessionId,
  excerpt,
  gateway,
  history,
  prompt,
  running,
  t,
}: ChildProjectionSurfaceProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string>()
  const [messages, setMessages] = useState<readonly SidecarTranscriptMessage[]>([])
  const [awaitingResponse, setAwaitingResponse] = useState(false)
  const [sending, setSending] = useState(false)
  const activeKey = `${childSessionId ?? 'pending'}:${afterSeq}`
  const activeKeyRef = useRef(activeKey)
  const historyRequestRef = useRef<{
    key: string
    promise: Promise<HistoryProjection>
  }>()
  const awaitedTurnEndAfterRef = useRef<number>()
  const latestTurnEndSeqRef = useRef(afterSeq)
  const mountedRef = useRef(true)
  const pendingExcerptRef = useRef(
    childSessionId === undefined ? excerpt : undefined,
  )
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
    if (childSessionId === undefined) {
      return Promise.resolve({ latestTurnEndSeq: afterSeq, messages: [] })
    }
    const current = historyRequestRef.current
    if (current?.key === activeKey) return current.promise

    const promise = history.history(childSessionId).then((events) => ({
      latestTurnEndSeq: events.reduce(
        (latest, event) =>
          event.type === 'turn/end' && event.seq > latest ? event.seq : latest,
        afterSeq,
      ),
      messages: buildTranscript(events, afterSeq),
    }))
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
    const projection = await readTranscript()
    if (mountedRef.current && activeKeyRef.current === activeKey) {
      latestTurnEndSeqRef.current = projection.latestTurnEndSeq
      setMessages(projection.messages)
      const awaitedAfter = awaitedTurnEndAfterRef.current
      if (
        awaitedAfter !== undefined &&
        projection.latestTurnEndSeq > awaitedAfter
      ) {
        awaitedTurnEndAfterRef.current = undefined
        setAwaitingResponse(false)
      }
    }
  }, [activeKey, readTranscript])

  useEffect(() => {
    if (childSessionId === undefined) {
      setMessages([])
      return () => undefined
    }
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
            awaitingResponse || runningRef.current
              ? ACTIVE_POLL_MS
              : IDLE_POLL_MS,
          )
        }
      }
    }
    void poll()
    return () => {
      live = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [awaitingResponse, childSessionId, refresh, running])

  const sendDraft = useCallback(async () => {
    const text = draft.trim()
    if (text === '' || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    setError(undefined)
    try {
      if (childSessionId !== undefined) {
        try {
          await refresh()
        } catch {
          // A stale history read must not block a valid prompt submission.
        }
      }
      const turnEndBaseline = latestTurnEndSeqRef.current
      const outgoing = promptWithSelectedContext(text, pendingExcerptRef.current)
      if (prompt !== undefined) {
        await prompt(outgoing)
      } else if (childSessionId !== undefined) {
        await gateway.prompt(childSessionId, outgoing)
      } else {
        throw new Error('No sidecar prompt target')
      }
      awaitedTurnEndAfterRef.current = turnEndBaseline
      setAwaitingResponse(true)
      pendingExcerptRef.current = undefined
      setDraft('')
      await refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [childSessionId, draft, gateway, prompt, refresh])

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
      <p className={styles.contextNote}>{t('composer.context')}</p>
      <div aria-live="polite" className={styles.transcript}>
        {messages.length === 0 && !awaitingResponse && !running ? (
          <p className={styles.empty}>{t('composer.empty')}</p>
        ) : (
          messages.map((message) => (
            <article className={styles[message.role]} key={message.id}>
              <span className={styles.role}>
                {t(
                  message.role === 'user'
                    ? 'role.user'
                    : message.role === 'assistant'
                      ? 'role.assistant'
                      : 'role.status',
                )}
              </span>
              {message.role === 'assistant' ? (
                <div className={styles.markdown}>
                  <MarkdownText
                    streaming={message.pending === true}
                    text={message.text}
                  />
                </div>
              ) : (
                <p>{message.text}</p>
              )}
            </article>
          ))
        )}
        {awaitingResponse || running ? (
          <div className={styles.responding} role="status">
            <span aria-hidden="true" className={styles.respondingDot} />
            <span>{t('composer.responding')}</span>
          </div>
        ) : null}
      </div>
      {error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <form className={styles.composer} onSubmit={submit}>
        <textarea
          aria-label={t('composer.aria')}
          autoFocus
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onComposerKeyDown}
          placeholder={t('composer.placeholder')}
          rows={3}
          value={draft}
        />
        <div className={styles.actions}>
          {running && childSessionId !== undefined ? (
            <button
              onClick={() => void gateway.cancel(childSessionId).catch(() => undefined)}
              type="button"
            >
              {t('composer.stop')}
            </button>
          ) : null}
          <button disabled={sending || draft.trim() === ''} type="submit">
            {t(sending ? 'composer.sending' : 'composer.send')}
          </button>
        </div>
      </form>
    </div>
  )
}

export function promptWithSelectedContext(
  prompt: string,
  excerpt: string | undefined,
): string {
  if (excerpt === undefined) return prompt
  return [
    '<dsh-sidecar-selected-context>',
    excerpt.replaceAll('\r\n', '\n'),
    '</dsh-sidecar-selected-context>',
    '',
    prompt,
  ].join('\n')
}
