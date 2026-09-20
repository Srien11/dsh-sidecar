import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
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
import {
  SIDECAR_WINDOW_EDGES,
  SIDECAR_WINDOW_KEYBOARD_STEP,
  type SidecarWindowEdge,
  type SidecarWindowRect,
  clampWindowRect,
  defaultWindowRect,
  moveWindowRect,
  nudgeWindowRect,
  readStoredWindowRect,
  resizeWindowRect,
  storeWindowRect,
} from '../window-geometry.js'
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

interface DragState {
  edge?: SidecarWindowEdge
  pointerId: number
  x: number
  y: number
}

function viewport(): { height: number; width: number } {
  return { height: window.innerHeight, width: window.innerWidth }
}

const KEY_DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
}

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
  const [frame, setFrame] = useState<SidecarWindowRect>(() =>
    clampWindowRect(
      readStoredWindowRect() ?? defaultWindowRect(viewport()),
      viewport(),
    ),
  )
  const dragRef = useRef<DragState>()

  useEffect(() => {
    setConfirmingArchive(false)
    setRenaming(false)
    setBranchError(undefined)
  }, [state.childId])

  useEffect(() => {
    storeWindowRect(frame)
  }, [frame])

  useEffect(() => {
    const onResize = () => {
      setFrame((current) => clampWindowRect(current, viewport()))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') void controller.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller, state.status])

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    edge?: SidecarWindowEdge,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      ...(edge === undefined ? {} : { edge }),
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    const target = event.currentTarget
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is an optimisation; drag state already tracks the id.
      }
    }
  }

  const dragWindow = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (drag === undefined || drag.pointerId !== event.pointerId) return
    const delta = { dx: event.clientX - drag.x, dy: event.clientY - drag.y }
    drag.x = event.clientX
    drag.y = event.clientY
    setFrame((current) =>
      drag.edge === undefined
        ? moveWindowRect(current, delta, viewport())
        : resizeWindowRect(current, drag.edge, delta, viewport()),
    )
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (drag === undefined || drag.pointerId !== event.pointerId) return
    dragRef.current = undefined
    const target = event.currentTarget
    if (typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already be gone with the pointer itself.
      }
    }
  }

  const dragHandlers = (edge?: SidecarWindowEdge) => ({
    onPointerCancel: endDrag,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => beginDrag(event, edge),
    onPointerMove: dragWindow,
    onPointerUp: endDrag,
  })

  /**
   * The whole title bar drags the window, not just the grip. Controls keep their
   * own behaviour: a press that starts on a button never turns into a drag.
   */
  const beginBarDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as Partial<Element> | null
    if (typeof target?.closest === 'function' && target.closest('button') !== null) {
      return
    }
    beginDrag(event)
  }

  const barDragHandlers = {
    onPointerCancel: endDrag,
    onPointerDown: beginBarDrag,
    onPointerMove: dragWindow,
    onPointerUp: endDrag,
  }

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = KEY_DIRECTIONS[event.key]
    if (direction === undefined) return
    event.preventDefault()
    const delta = {
      dx: direction.dx * SIDECAR_WINDOW_KEYBOARD_STEP,
      dy: direction.dy * SIDECAR_WINDOW_KEYBOARD_STEP,
    }
    setFrame((current) => {
      if (!event.shiftKey) return nudgeWindowRect(current, direction, viewport())
      const edge: SidecarWindowEdge = direction.dx !== 0 ? 'e' : 's'
      return resizeWindowRect(current, edge, delta, viewport())
    })
  }

  if (state.status === 'closed') return null

  const frameStyle = {
    '--dsh-sidecar-window-height': `${frame.height}px`,
    '--dsh-sidecar-window-left': `${frame.left}px`,
    '--dsh-sidecar-window-top': `${frame.top}px`,
    '--dsh-sidecar-window-width': `${frame.width}px`,
  } as CSSProperties

  return (
    <aside
      aria-label={t('drawer.aria')}
      className={styles.drawer}
      style={frameStyle}
    >
      {SIDECAR_WINDOW_EDGES.map((edge) => (
        <span
          aria-hidden="true"
          className={`${styles.windowResize} ${styles.windowResizeEdge(edge)}`}
          key={edge}
          {...dragHandlers(edge)}
        />
      ))}
      <header className={styles.header} {...barDragHandlers}>
        <button
          aria-label={t('window.drag')}
          className={styles.windowHandle}
          onKeyDown={onHandleKeyDown}
          title={t('window.dragTitle')}
          type="button"
          {...dragHandlers()}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <div>
          <strong>{t('drawer.title')}</strong>
          <small>{t('drawer.subtitle')}</small>
        </div>
        <button
          className={styles.windowReset}
          onClick={() => setFrame(defaultWindowRect(viewport()))}
          title={t('window.resetTitle')}
          type="button"
        >
          {t('window.reset')}
        </button>
        <button
          aria-label={t('drawer.close')}
          className={styles.close}
          onClick={() => void controller.close()}
          type="button"
        >
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
      state.childId !== undefined ? (
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
      state.turnEndSeq !== undefined ? (
        <ChildProjectionSurface
          afterSeq={state.childAfterSeq ?? state.turnEndSeq}
          {...(state.childId === undefined
            ? {}
            : { childSessionId: state.childId })}
          {...(state.excerpt === undefined ? {} : { excerpt: state.excerpt })}
          gateway={gateway}
          history={history}
          key={state.anchorKey ?? state.childId}
          prompt={(text) => controller.prompt(text)}
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
