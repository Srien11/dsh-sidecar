import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import { useSyncExternalStore } from 'react'

import type { SidecarUiController } from '../controllers/sidecar-controller.js'
import {
  canSnapshotFollowUp,
  snapshotFollowUpAnchor,
} from '../controllers/frozen-history.js'
import { SIDECAR_LOCALE_NAMESPACE } from '../locales.js'
import { styles } from '../styles.js'

interface StreamingSidecarActionInjected {
  controller: SidecarUiController
}

export type StreamingSidecarActionProps =
  PropsRuntime<'conversation.input.right'> &
    PropsLocale<typeof SIDECAR_LOCALE_NAMESPACE> &
    InjectFace<StreamingSidecarActionInjected>

export function StreamingSidecarAction({
  controller,
  sessionId,
  t,
  useChat,
  useSession,
}: StreamingSidecarActionProps) {
  const chat = useChat((snapshot: ChatSnapshot) => snapshot)
  const running = useSession((snapshot: SessionSnapshot) => snapshot.running)
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  if (!canSnapshotFollowUp(chat, running)) return null

  const busy =
    state.status === 'opening' &&
    state.parentId === sessionId
  const label = t(busy ? 'action.opening' : 'action.askCurrent')

  return (
    <button
      aria-label={label}
      className={`${styles.action} ${styles.streamingAction}`}
      disabled={busy}
      onClick={(event) => {
        const anchor = snapshotFollowUpAnchor(chat, running)
        if (anchor === undefined) return
        controller.rememberReturnFocus(event.currentTarget)
        void controller
          .open({
            fresh: true,
            frozenHistory: anchor.frozenHistory,
            mode: 'snapshot',
            parentId: sessionId,
            seedLength: 0,
            sourceTurn: anchor.sourceTurn,
            turnEndSeq: anchor.sourceAnchorSeq,
          })
          .catch(() => undefined)
      }}
      title={t('action.currentTitle')}
      type="button"
    >
      <span aria-hidden="true">↗</span>
      <span>{label}</span>
    </button>
  )
}
