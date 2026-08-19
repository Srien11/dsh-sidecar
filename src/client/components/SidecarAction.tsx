import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import type { SidecarUiController } from '../controllers/sidecar-controller.js'
import { SIDECAR_LOCALE_NAMESPACE } from '../locales.js'
import {
  selectionSnapshotWithin,
  selectionTextWithin,
} from '../controllers/selection.js'
import { styles } from '../styles.js'

interface SidecarActionInjected {
  controller: SidecarUiController
}

export type SidecarActionProps = PropsRuntime<'conversation.chat.assistant-actions'> &
  PropsLocale<typeof SIDECAR_LOCALE_NAMESPACE> &
  InjectFace<SidecarActionInjected>

interface AnswerBoundary {
  seedLength: number
  turnEndSeq: number
}

interface FloatingSelection {
  left: number
  text: string
  top: number
}

function floatingPosition(rect: DOMRect): Pick<FloatingSelection, 'left' | 'top'> {
  const gap = 8
  const estimatedWidth = 112
  const estimatedHeight = 36
  const maxLeft = Math.max(gap, window.innerWidth - estimatedWidth - gap)
  const maxTop = Math.max(gap, window.innerHeight - estimatedHeight - gap)
  return {
    left: Math.max(gap, Math.min(rect.right + gap, maxLeft)),
    top: Math.max(gap, Math.min(rect.bottom + gap, maxTop)),
  }
}

function answerBoundary(
  snapshot: ConversationSnapshot,
  messageId: MessageId,
): AnswerBoundary | undefined {
  const node = snapshot.nodes.find(
    (candidate) =>
      candidate.kind === 'assistant' && candidate.messageId === messageId,
  )
  if (node?.kind !== 'assistant' || node.messageId === undefined) return undefined

  const turnEndSeq = snapshot.turnEnds.get(node.turn)
  return turnEndSeq === undefined
    ? undefined
    : { seedLength: turnEndSeq + 1, turnEndSeq }
}

/**
 * Public slot contract in Harness 0.1.0-rc.6:
 * `conversation.chat.assistant-actions` is a session-scoped list slot whose
 * owner supplies `messageId`; standard props add `sessionId`, `useSession`,
 * and `useSessions`. Only finalized Assistant messages reach this site.
 */
export function SidecarAction({
  controller,
  messageId,
  sessionId,
  t,
  useSession,
  useSessions,
  useWorkspaces,
}: SidecarActionProps) {
  const boundary = useSession((snapshot) => answerBoundary(snapshot, messageId))
  const sessionVersion = useSessions((snapshot) => snapshot.ids.join('\u001f'))
  const archiveVersion = useWorkspaces((snapshot) =>
    snapshot.archivedSessionIds.join('\u001f'),
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const [count, setCount] = useState(0)
  const [floating, setFloating] = useState<FloatingSelection>()
  const actionRef = useRef<HTMLButtonElement>(null)
  const pointerExcerpt = useRef<string>()

  useEffect(() => {
    let live = true
    if (boundary === undefined) return () => undefined

    void controller
      .branchCount(sessionId, boundary.turnEndSeq)
      .then((next) => {
        if (live) setCount(next)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [archiveVersion, boundary?.turnEndSeq, controller, sessionId, sessionVersion])

  useEffect(() => {
    let frame: number | undefined
    const update = () => {
      frame = undefined
      const action = actionRef.current
      const snapshot =
        action === null ? undefined : selectionSnapshotWithin(action)
      if (snapshot === undefined) {
        setFloating(undefined)
        return
      }
      const position = floatingPosition(snapshot.rect)
      setFloating((current) => {
        if (
          current?.text === snapshot.text &&
          current.left === position.left &&
          current.top === position.top
        ) {
          return current
        }
        return { ...position, text: snapshot.text }
      })
    }
    const schedule = () => {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame?.(update) ?? window.setTimeout(update, 0)
    }

    document.addEventListener('selectionchange', schedule)
    document.addEventListener('pointerup', schedule)
    document.addEventListener('keyup', schedule)
    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      document.removeEventListener('selectionchange', schedule)
      document.removeEventListener('pointerup', schedule)
      document.removeEventListener('keyup', schedule)
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      if (frame !== undefined) {
        if (window.cancelAnimationFrame === undefined) window.clearTimeout(frame)
        else window.cancelAnimationFrame(frame)
      }
    }
  }, [])

  if (boundary === undefined) return null

  const key = `${sessionId}:${boundary.turnEndSeq}`
  const busy = state.status === 'opening' && state.anchorKey === key
  const label = t(busy ? 'action.opening' : 'action.ask')

  const open = (returnFocus: HTMLElement, excerpt?: string) => {
    controller.rememberReturnFocus(returnFocus)
    pointerExcerpt.current = undefined
    setFloating(undefined)
    void controller
      .open({
        ...(excerpt === undefined ? {} : { excerpt }),
        parentId: sessionId,
        seedLength: boundary.seedLength,
        turnEndSeq: boundary.turnEndSeq,
      })
      .catch(() => undefined)
  }

  return (
    <>
      <button
        aria-disabled={busy}
        aria-label={label}
        className={styles.action}
        disabled={busy}
        onClick={(event) => {
          const excerpt =
            pointerExcerpt.current ?? selectionTextWithin(event.currentTarget)
          open(event.currentTarget, excerpt)
        }}
        onPointerDown={(event) => {
          pointerExcerpt.current = selectionTextWithin(event.currentTarget)
        }}
        ref={actionRef}
        title={t(busy ? 'action.openingTitle' : 'action.title')}
        type="button"
      >
        <span aria-hidden="true">↗</span>
        <span>{label}</span>
        {count > 0 ? <span className={styles.count}>{count}</span> : null}
      </button>
      {floating === undefined
        ? null
        : createPortal(
            <button
              aria-label={t('action.askSelection')}
              className={styles.selectionAction}
              disabled={busy}
              onClick={(event) => {
                const excerpt = pointerExcerpt.current ?? floating.text
                window.getSelection()?.removeAllRanges()
                open(
                  actionRef.current ?? event.currentTarget,
                  excerpt,
                )
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                pointerExcerpt.current = floating.text
              }}
              style={{
                left: `${floating.left}px`,
                position: 'fixed',
                top: `${floating.top}px`,
              }}
              title={t('action.selectionTitle')}
              type="button"
            >
              <span aria-hidden="true">↗</span>
              <span>{t('action.ask')}</span>
            </button>,
            document.body,
          )}
    </>
  )
}
