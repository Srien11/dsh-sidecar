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

import {
  applyAnswerHighlights,
  clearAnswerHighlights,
  type AnswerHighlightTarget,
} from '../answer-highlight.js'
import type {
  SidecarBranchInfo,
  SidecarUiController,
} from '../controllers/sidecar-controller.js'
import { SIDECAR_LOCALE_NAMESPACE } from '../locales.js'
import {
  assistantAnswerForAction,
  selectionSnapshotWithin,
  selectionTextWithin,
  selectionWithin,
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
  offset?: number
  text: string
  top: number
}

interface OpenRequest {
  branchId?: string
  excerpt?: string
  excerptOffset?: number
  returnFocus: HTMLElement
}

const OPTION_LABEL_LIMIT = 64

function truncate(text: string, limit = OPTION_LABEL_LIMIT): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length <= limit
    ? collapsed
    : `${collapsed.slice(0, limit - 1)}…`
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
  const [branches, setBranches] = useState<readonly SidecarBranchInfo[]>([])
  const [floating, setFloating] = useState<FloatingSelection>()
  const actionRef = useRef<HTMLButtonElement>(null)
  const pointerSelection = useRef<{ offset?: number; text: string }>()
  const highlightRef = useRef<{
    activate: (childId: string, element: HTMLElement) => void
    describe: (target: AnswerHighlightTarget) => string
    targets: readonly AnswerHighlightTarget[]
  }>({ activate: () => undefined, describe: () => '', targets: [] })
  const syncHighlights = useRef<() => void>(() => undefined)

  useEffect(() => {
    let live = true
    if (boundary === undefined) return () => undefined

    void controller
      .branches(sessionId, boundary.turnEndSeq)
      .then((next) => {
        if (live) setBranches(next)
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
          current.offset === snapshot.offset &&
          current.left === position.left &&
          current.top === position.top
        ) {
          return current
        }
        return {
          ...position,
          ...(snapshot.offset === undefined ? {} : { offset: snapshot.offset }),
          text: snapshot.text,
        }
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

  const labelOf = (branch: SidecarBranchInfo, index: number): string => {
    if (branch.summary !== undefined) return branch.summary
    if (branch.title !== undefined) return branch.title
    if (branch.excerpt !== undefined) return branch.excerpt
    return t('branch.followUp', { number: index + 1 })
  }
  const labels = new Map(
    branches.map((branch, index) => [branch.childId, labelOf(branch, index)]),
  )
  const highlightTargets: readonly AnswerHighlightTarget[] = branches.flatMap(
    (branch) =>
      branch.excerpt === undefined
        ? []
        : [
            {
              childId: branch.childId,
              excerpt: branch.excerpt,
              ...(branch.excerptOffset === undefined
                ? {}
                : { excerptOffset: branch.excerptOffset }),
            },
          ],
  )

  const open = (request: OpenRequest) => {
    if (boundary === undefined) return
    controller.rememberReturnFocus(request.returnFocus)
    pointerSelection.current = undefined
    setFloating(undefined)
    void controller
      .open({
        ...(request.branchId === undefined
          ? { fresh: true as const }
          : { branchId: request.branchId }),
        ...(request.excerpt === undefined ? {} : { excerpt: request.excerpt }),
        ...(request.excerptOffset === undefined
          ? {}
          : { excerptOffset: request.excerptOffset }),
        parentId: sessionId,
        seedLength: boundary.seedLength,
        turnEndSeq: boundary.turnEndSeq,
      })
      .catch(() => undefined)
  }

  useEffect(() => {
    highlightRef.current = {
      activate: (childId: string, element: HTMLElement) => {
        open({ branchId: childId, returnFocus: element })
      },
      describe: (target: AnswerHighlightTarget) => {
        const summary = labels.get(target.childId)
        return summary === undefined
          ? t('highlight.openFallback')
          : t('highlight.open', { summary: truncate(summary, 48) })
      },
      targets: highlightTargets,
    }
    syncHighlights.current()
  })

  useEffect(() => {
    const action = actionRef.current
    if (action === null || boundary === undefined) return () => undefined

    const answer = assistantAnswerForAction(action)
    if (answer === undefined) return () => undefined

    let frame: number | undefined
    const sync = () => {
      frame = undefined
      const current = highlightRef.current
      applyAnswerHighlights(answer, current.targets, {
        activate: (childId, element) => current.activate(childId, element),
        describe: (target) => current.describe(target),
      })
    }
    const schedule = () => {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame?.(sync) ?? window.setTimeout(sync, 0)
    }
    syncHighlights.current = sync

    // Re-apply when the Host re-renders the answer and drops injected marks.
    const observer = new MutationObserver(schedule)
    observer.observe(answer, { childList: true, subtree: true })
    const onResize = () => schedule()
    window.addEventListener('resize', onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      if (syncHighlights.current === sync) syncHighlights.current = () => undefined
      if (frame !== undefined) {
        if (window.cancelAnimationFrame === undefined) window.clearTimeout(frame)
        else window.cancelAnimationFrame(frame)
      }
      clearAnswerHighlights(answer)
    }
  }, [boundary?.turnEndSeq, sessionId])

  if (boundary === undefined) return null

  const key = `${sessionId}:${boundary.turnEndSeq}`
  const busy =
    state.status === 'opening' &&
    (state.anchorKey === key ||
      state.anchorKey?.startsWith(`${key}:draft:`) === true ||
      state.anchorKey?.startsWith(`${key}:branch:`) === true)
  const activeBranchId =
    state.status !== 'closed' &&
    state.parentId === sessionId &&
    state.turnEndSeq === boundary.turnEndSeq &&
    state.childId !== undefined &&
    branches.some((branch) => branch.childId === state.childId)
      ? state.childId
      : ''
  const label = t(busy ? 'action.opening' : 'action.ask')
  const latest = branches[0]
  const existingLabel =
    latest === undefined
      ? t('branch.existingCount', { count: branches.length })
      : t('branch.latest', {
          count: branches.length,
          summary: truncate(labelOf(latest, 0), 40),
        })

  return (
    <>
      <button
        aria-disabled={busy}
        aria-label={label}
        className={styles.action}
        disabled={busy}
        onClick={(event) => {
          const captured = pointerSelection.current
          const excerpt =
            captured?.text ?? selectionTextWithin(event.currentTarget)
          open({
            ...(captured?.offset === undefined
              ? {}
              : { excerptOffset: captured.offset }),
            ...(excerpt === undefined ? {} : { excerpt }),
            returnFocus: event.currentTarget,
          })
        }}
        onPointerDown={(event) => {
          const captured = selectionWithin(event.currentTarget)
          pointerSelection.current =
            captured === undefined
              ? undefined
              : {
                  ...(captured.offset === undefined
                    ? {}
                    : { offset: captured.offset }),
                  text: captured.text,
                }
        }}
        ref={actionRef}
        title={t(busy ? 'action.openingTitle' : 'action.title')}
        type="button"
      >
        <span aria-hidden="true">↗</span>
        <span>{label}</span>
      </button>
      {branches.length === 0 ? null : (
        <select
          aria-label={t('branch.existing')}
          className={`${styles.branchRestore}${
            activeBranchId === '' ? '' : ` ${styles.branchRestoreActive}`
          }`}
          disabled={busy}
          onChange={(event) => {
            const branchId = event.currentTarget.value
            if (branchId !== '') {
              open({ branchId, returnFocus: event.currentTarget })
            }
          }}
          value={activeBranchId}
        >
          <option value="">{existingLabel}</option>
          {branches.map((branch, index) => (
            <option
              aria-current={branch.childId === activeBranchId ? 'true' : undefined}
              key={branch.childId}
              title={t('branch.optionTitle', {
                summary: labelOf(branch, index),
              })}
              value={branch.childId}
            >
              {truncate(labelOf(branch, index))}
            </option>
          ))}
        </select>
      )}
      {floating === undefined
        ? null
        : createPortal(
            <button
              aria-label={t('action.askSelection')}
              className={styles.selectionAction}
              disabled={busy}
              onClick={(event) => {
                const captured = pointerSelection.current
                const excerpt = captured?.text ?? floating.text
                window.getSelection()?.removeAllRanges()
                open({
                  ...(captured?.offset === undefined
                    ? floating.offset === undefined
                      ? {}
                      : { excerptOffset: floating.offset }
                    : { excerptOffset: captured.offset }),
                  excerpt,
                  returnFocus: actionRef.current ?? event.currentTarget,
                })
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                pointerSelection.current = {
                  ...(floating.offset === undefined
                    ? {}
                    : { offset: floating.offset }),
                  text: floating.text,
                }
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
