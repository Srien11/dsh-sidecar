import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import type { SidecarHistoryReader } from '../controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../controllers/session-gateway.js'
import type { SidecarUiController } from '../controllers/sidecar-controller.js'
import { ChildProjectionSurface } from './ChildProjectionSurface.js'
import { styles } from '../styles.js'

interface SidecarDrawerInjected {
  controller: SidecarUiController
  gateway: SidecarSessionGateway
  history: SidecarHistoryReader
  openSession: (sessionId: string) => void
}

export type SidecarDrawerProps = PropsRuntime<'shell.overlay'> &
  InjectFace<SidecarDrawerInjected>

export function SidecarDrawer({
  controller,
  gateway,
  history,
  openSession,
  useSessions,
}: SidecarDrawerProps) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const sessions = useSessions((snapshot) => snapshot)
  const child =
    state.childId === undefined
      ? undefined
      : sessions.byId[state.childId as SessionId]
  const running = child?.running ?? false
  const pendingInteraction = child?.pendingInteraction
  const [renaming, setRenaming] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [branchError, setBranchError] = useState<string>()

  useEffect(() => {
    setRenaming(false)
    setBranchError(undefined)
  }, [state.childId])

  const saveRename = async (event: FormEvent) => {
    event.preventDefault()
    const title = renameTitle.trim()
    if (state.childId === undefined || title === '') return
    setBranchError(undefined)
    try {
      await gateway.rename(state.childId, title)
      setRenaming(false)
    } catch (error) {
      setBranchError(error instanceof Error ? error.message : String(error))
    }
  }

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
      state.branchIds !== undefined ? (
        <div className={styles.branches}>
          {renaming ? (
            <form className={styles.branchEditor} onSubmit={saveRename}>
              <input
                aria-label="分支名称"
                autoFocus
                onChange={(event) => setRenameTitle(event.currentTarget.value)}
                value={renameTitle}
              />
              <button disabled={renameTitle.trim() === ''} type="submit">
                保存名称
              </button>
              <button onClick={() => setRenaming(false)} type="button">
                取消
              </button>
            </form>
          ) : (
            <>
              <select
                aria-label="侧边追问分支"
                onChange={(event) => {
                  void controller
                    .selectBranch(event.currentTarget.value)
                    .catch(() => undefined)
                }}
                value={state.childId}
              >
                {state.branchIds.map((branchId, index) => (
                  <option key={branchId} value={branchId}>
                    {sessions.byId[branchId as SessionId]?.displayTitle ??
                      `分支 ${index + 1}`}
                  </option>
                ))}
              </select>
              <button
                aria-label="重命名当前分支"
                onClick={() => {
                  setRenameTitle(child?.displayTitle ?? '')
                  setRenaming(true)
                }}
                type="button"
              >
                重命名
              </button>
              <button
                aria-label="新建分支"
                onClick={() =>
                  void controller.createBranch().catch(() => undefined)
                }
                type="button"
              >
                ＋ 新建
              </button>
            </>
          )}
        </div>
      ) : null}
      {branchError === undefined ? null : (
        <p className={styles.error} role="alert">
          {branchError}
        </p>
      )}
      {state.status === 'open' &&
      state.childId !== undefined &&
      pendingInteraction !== undefined ? (
        <div className={styles.pending} role="status">
          <p>{pendingInteractionText(pendingInteraction)}</p>
          <button
            onClick={() => {
              void controller.close()
              openSession(state.childId as string)
            }}
            type="button"
          >
            打开子会话处理
          </button>
        </div>
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
          key={state.childId}
          running={running}
        />
      ) : null}
    </aside>
  )
}

function pendingInteractionText(kind: 'approval' | 'plan-review' | 'question'): string {
  if (kind === 'approval') return '侧边会话正在等待工具审批。'
  if (kind === 'question') return '侧边会话正在等待你的回答。'
  return '侧边会话正在等待计划确认。'
}
