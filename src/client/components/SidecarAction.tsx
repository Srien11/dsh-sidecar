import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { SidecarUiController } from '../controllers/sidecar-controller.js'
import { selectionTextWithin } from '../controllers/selection.js'
import { styles } from '../styles.js'

interface SidecarActionInjected {
  controller: SidecarUiController
}

export type SidecarActionProps = PropsRuntime<'conversation.chat.assistant-actions'> &
  InjectFace<SidecarActionInjected>

interface AnswerBoundary {
  seedLength: number
  turnEndSeq: number
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

  if (boundary === undefined) return null

  const key = `${sessionId}:${boundary.turnEndSeq}`
  const busy = state.status === 'opening' && state.anchorKey === key
  const label = busy ? '正在打开追问' : '追问'

  return (
    <button
      aria-disabled={busy}
      aria-label={label}
      className={styles.action}
      disabled={busy}
      onClick={(event) => {
        controller.rememberReturnFocus(event.currentTarget)
        const excerpt = pointerExcerpt.current ?? selectionTextWithin(event.currentTarget)
        pointerExcerpt.current = undefined
        void controller
          .open({
            ...(excerpt === undefined ? {} : { excerpt }),
            parentId: sessionId,
            seedLength: boundary.seedLength,
            turnEndSeq: boundary.turnEndSeq,
          })
          .catch(() => undefined)
      }}
      onPointerDown={(event) => {
        pointerExcerpt.current = selectionTextWithin(event.currentTarget)
      }}
      title={busy ? '正在创建或恢复分支…' : '在侧边栏中追问，不改动主对话'}
      type="button"
    >
      <span aria-hidden="true">↗</span>
      <span>{label}</span>
      {count > 0 ? <span className={styles.count}>{count}</span> : null}
    </button>
  )
}
