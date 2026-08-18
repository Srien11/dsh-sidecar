import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import type { SidecarHistoryReader } from '../controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../controllers/session-gateway.js'
import type { SidecarUiController } from '../controllers/sidecar-controller.js'
import {
  SIDECAR_LOCALE_NAMESPACE,
  type SidecarTranslate,
} from '../locales.js'
import { ChildProjectionSurface } from './ChildProjectionSurface.js'
import { styles } from '../styles.js'

interface SidecarDrawerInjected {
  controller: SidecarUiController
  gateway: SidecarSessionGateway
  history: SidecarHistoryReader
  openSession: (sessionId: string) => void
}

export type SidecarDrawerProps = PropsRuntime<'shell.overlay'> &
  PropsLocale<typeof SIDECAR_LOCALE_NAMESPACE> &
  InjectFace<SidecarDrawerInjected>

export function SidecarDrawer({
  controller,
  gateway,
  history,
  openSession,
  t,
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
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [branchError, setBranchError] = useState<string>()

  useEffect(() => {
    setConfirmingArchive(false)
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
    <aside aria-label={t('drawer.aria')} className={styles.drawer}>
      <header className={styles.header}>
        <div>
          <strong>{t('drawer.title')}</strong>
          <small>{t('drawer.subtitle')}</small>
        </div>
        <button aria-label={t('drawer.close')} onClick={() => void controller.close()} type="button">
          ×
        </button>
      </header>
      {state.status === 'opening' ? (
        <p className={styles.status}>{t('drawer.opening')}</p>
      ) : null}
      {state.status === 'error' ? (
        <p className={styles.status} role="alert">
          {state.error ?? t('drawer.openError')}
        </p>
      ) : null}
      {state.status === 'open' &&
      state.childId !== undefined &&
      state.branchIds !== undefined ? (
        <div className={styles.branches}>
          {renaming ? (
            <form className={styles.branchEditor} onSubmit={saveRename}>
              <input
                aria-label={t('rename.input')}
                autoFocus
                onChange={(event) => setRenameTitle(event.currentTarget.value)}
                value={renameTitle}
              />
              <button disabled={renameTitle.trim() === ''} type="submit">
                {t('rename.save')}
              </button>
              <button onClick={() => setRenaming(false)} type="button">
                {t('rename.cancel')}
              </button>
            </form>
          ) : confirmingArchive ? (
            <div className={styles.branchEditor} role="group" aria-label={t('archive.group')}>
              <span>{t('archive.prompt')}</span>
              <button
                onClick={() => {
                  setConfirmingArchive(false)
                  void controller.archiveCurrentBranch().catch(() => undefined)
                }}
                type="button"
              >
                {t('archive.confirm')}
              </button>
              <button onClick={() => setConfirmingArchive(false)} type="button">
                {t('archive.cancel')}
              </button>
            </div>
          ) : (
            <>
              <select
                aria-label={t('branch.label')}
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
                      t('branch.fallback', { number: index + 1 })}
                  </option>
                ))}
              </select>
              <button
                aria-label={t('branch.renameAria')}
                onClick={() => {
                  setRenameTitle(child?.displayTitle ?? '')
                  setRenaming(true)
                }}
                type="button"
              >
                {t('branch.rename')}
              </button>
              <button
                aria-label={t('branch.newAria')}
                onClick={() =>
                  void controller.createBranch().catch(() => undefined)
                }
                type="button"
              >
                {t('branch.new')}
              </button>
              <button
                aria-label={t('branch.archiveAria')}
                onClick={() => setConfirmingArchive(true)}
                type="button"
              >
                {t('branch.archive')}
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
          <p>{pendingInteractionText(pendingInteraction, t)}</p>
          <button
            onClick={() => {
              void controller.close()
              openSession(state.childId as string)
            }}
            type="button"
          >
            {t('pending.open')}
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
          t={t}
        />
      ) : null}
    </aside>
  )
}

function pendingInteractionText(
  kind: 'approval' | 'plan-review' | 'question',
  t: SidecarTranslate,
): string {
  if (kind === 'approval') return t('pending.approval')
  if (kind === 'question') return t('pending.question')
  return t('pending.plan')
}
