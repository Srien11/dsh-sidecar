import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useSyncExternalStore } from 'react'

import type { SidecarHistoryReader } from '../controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../controllers/session-gateway.js'
import type { SidecarUiController } from '../controllers/sidecar-controller.js'
import { ChildProjectionSurface } from './ChildProjectionSurface.js'
import { styles } from '../styles.js'

interface SidecarDrawerInjected {
  controller: SidecarUiController
  gateway: SidecarSessionGateway
  history: SidecarHistoryReader
}

export type SidecarDrawerProps = PropsRuntime<'shell.overlay'> &
  InjectFace<SidecarDrawerInjected>

export function SidecarDrawer({
  controller,
  gateway,
  history,
  useSessions,
}: SidecarDrawerProps) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const running = useSessions((snapshot) =>
    state.childId === undefined
      ? false
      : (snapshot.byId[state.childId as SessionId]?.running ?? false),
  )

  useEffect(() => {
    if (state.status === 'closed') return () => undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void controller.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller, state.status])

  if (state.status === 'closed') return null

  return (
    <aside aria-label="侧边追问" className={styles.drawer}>
      <header className={styles.header}>
        <div>
          <strong>侧边追问</strong>
          <small>独立保存 · 不写入主对话</small>
        </div>
        <button aria-label="关闭侧边追问" onClick={() => void controller.close()} type="button">
          ×
        </button>
      </header>
      {state.status === 'opening' ? <p className={styles.status}>正在创建或恢复分支…</p> : null}
      {state.status === 'error' ? (
        <p className={styles.status} role="alert">
          {state.error ?? '无法打开分支，请先检查已有分支。'}
        </p>
      ) : null}
      {state.status === 'open' &&
      state.childId !== undefined &&
      state.turnEndSeq !== undefined ? (
        <ChildProjectionSurface
          afterSeq={state.turnEndSeq}
          childSessionId={state.childId}
          {...(state.excerpt === undefined ? {} : { excerpt: state.excerpt })}
          gateway={gateway}
          history={history}
          running={running}
        />
      ) : null}
    </aside>
  )
}
