import type {
  ISessions,
  IWorkspaces,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'

import { followUpSummary, sidecarAnchor } from '../../domain/anchor.js'
import type { AnchorRepository } from '../../host/anchor-repository.js'
import type { SidecarAnchor } from '../../domain/types.js'
import type { ForkController, OpenSidecarInput } from './fork-controller.js'
import { promptWithFrozenHistory } from './frozen-history.js'
import type { SidecarSessionGateway } from './session-gateway.js'
import { visibleUserText } from './transcript.js'

export type SidecarControllerStatus = 'closed' | 'error' | 'open' | 'opening'

/**
 * One restorable follow-up attached to a finished answer.
 *
 * Carries everything the tail summary list and the in-answer highlight need, so
 * neither surface has to re-read history: `summary` is the first question asked
 * in the follow-up, `title` is the Host-projected session title, and `excerpt`
 * (with `excerptOffset`) is the exact answer text the follow-up was opened
 * from.
 */
export interface SidecarBranchInfo {
  childId: string
  excerpt?: string
  excerptOffset?: number
  summary?: string
  title?: string
  updatedAt: number
}

export interface SidecarControllerState {
  status: SidecarControllerStatus
  anchorKey?: string
  branchIds?: readonly string[]
  childId?: string
  parentId?: string
  seedLength?: number
  turnEndSeq?: number
  error?: string
  excerpt?: string
  excerptOffset?: number
  frozenHistory?: string
  mode?: 'fork' | 'snapshot'
  sourceTurn?: number
  childAfterSeq?: number
  snapshotSeedPending?: boolean
}

export type OpenSidecarUiInput = Omit<OpenSidecarInput, 'existingChildId'> & {
  branchId?: string
  fresh?: true
  frozenHistory?: string
  mode?: 'fork' | 'snapshot'
  sourceTurn?: number
}

export interface SidecarUiController {
  getSnapshot(): SidecarControllerState
  subscribe(listener: () => void): () => void
  open(input: OpenSidecarUiInput): Promise<string | undefined>
  close(): Promise<void>
  branchCount(parentId: string, turnEndSeq: number): Promise<number>
  branches(parentId: string, turnEndSeq: number): Promise<readonly SidecarBranchInfo[]>
  prompt(text: string): Promise<void>
  archiveCurrentBranch(): Promise<void>
  createBranch(): Promise<string>
  rememberReturnFocus(target: HTMLElement): void
  selectBranch(childId: string): Promise<void>
}

function uiAnchorKey(parentId: string, turnEndSeq: number): string {
  return `${parentId}:${turnEndSeq}`
}

/** Only the session-list fields a branch summary is derived from. */
interface BranchSessionSummary {
  title?: string | undefined
  updatedAt?: number | undefined
}

/**
 * Project one restorable follow-up for the tail summary list and the in-answer
 * highlight. Absent fields stay absent so the UI can fall back in a defined
 * order (stored summary → Host title → excerpt → positional label).
 */
function branchInfoOf(
  childId: string,
  anchor: SidecarAnchor | undefined,
  session: BranchSessionSummary | undefined,
): SidecarBranchInfo {
  return {
    childId,
    ...(anchor?.excerpt === undefined ? {} : { excerpt: anchor.excerpt }),
    ...(anchor?.excerptOffset === undefined
      ? {}
      : { excerptOffset: anchor.excerptOffset }),
    ...(anchor?.summary === undefined ? {} : { summary: anchor.summary }),
    ...(session?.title === undefined ? {} : { title: session.title }),
    updatedAt: session?.updatedAt ?? 0,
  }
}

export class SidecarController implements SidecarUiController {
  private state: SidecarControllerState = { status: 'closed' }
  private readonly listeners = new Set<() => void>()
  private readonly preparedChildren = new Map<string, string>()
  private operationEpoch = 0
  private returnFocusTarget: HTMLElement | undefined

  constructor(
    private readonly forks: ForkController,
    private readonly gateway: SidecarSessionGateway,
    private readonly sessions: ISessions,
    private readonly workspaces: IWorkspaces,
    private readonly anchors: AnchorRepository,
  ) {}

  getSnapshot = (): SidecarControllerState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async branchCount(parentId: string, turnEndSeq: number): Promise<number> {
    return (await this.branches(parentId, turnEndSeq)).length
  }

  async branches(
    parentId: string,
    turnEndSeq: number,
  ): Promise<readonly SidecarBranchInfo[]> {
    return this.findBranches(parentId, turnEndSeq)
  }

  async prompt(text: string): Promise<void> {
    const currentChildId = this.state.childId
    // The question that opens a follow-up becomes its summary. Recorded on the
    // anchor at creation time so later reads stay cheap (no history replay).
    const summary = followUpSummary(visibleUserText(text))
    if (currentChildId !== undefined) {
      const outgoing =
        this.state.snapshotSeedPending === true &&
        this.state.frozenHistory !== undefined
          ? promptWithFrozenHistory(this.state.frozenHistory, text)
          : text
      await this.gateway.prompt(currentChildId, outgoing)
      if (this.state.childId === currentChildId && this.state.snapshotSeedPending) {
        this.setState({ ...this.state, snapshotSeedPending: false })
        this.preparedChildren.delete(this.state.anchorKey ?? '')
      }
      return
    }

    const anchor = this.activeAnchor()
    const createdAnchor =
      summary === undefined ? anchor : { ...anchor, summary }
    const key =
      this.state.anchorKey ?? uiAnchorKey(anchor.parentId, anchor.turnEndSeq)
    if (anchor.mode === 'snapshot') {
      const frozenHistory = this.state.frozenHistory
      if (frozenHistory === undefined || anchor.sourceTurn === undefined) {
        throw new Error('No frozen history is available for this follow-up')
      }
      const prepared = this.preparedChildren.get(key)
      const childId =
        prepared ?? (await this.gateway.createIndependent(anchor.parentId)).childId
      this.preparedChildren.set(key, childId)
      await this.hideChild(childId, createdAnchor)
      if (this.state.status === 'open' && this.state.anchorKey === key) {
        this.setState({
          ...this.state,
          branchIds: [
            childId,
            ...(this.state.branchIds ?? []).filter((id) => id !== childId),
          ],
          childAfterSeq: 0,
          childId,
          snapshotSeedPending: true,
        })
      }
      await this.gateway.prompt(
        childId,
        promptWithFrozenHistory(frozenHistory, text),
      )
      this.preparedChildren.delete(key)
      if (this.state.childId === childId) {
        this.setState({ ...this.state, snapshotSeedPending: false })
      }
      return
    }

    const prepared = this.preparedChildren.get(key)
    const childId = prepared ?? (await this.forks.open(createdAnchor))
    this.preparedChildren.set(key, childId)
    await this.hideChild(childId, createdAnchor)
    await this.gateway.prompt(childId, text)
    this.preparedChildren.delete(key)

    if (this.state.status === 'open' && this.state.anchorKey === key) {
      this.setState({
        ...this.state,
        branchIds: [
          childId,
          ...(this.state.branchIds ?? []).filter((id) => id !== childId),
        ],
        childId,
      })
    }
  }

  async open(input: OpenSidecarUiInput): Promise<string | undefined> {
    const epoch = ++this.operationEpoch
    const baseKey = uiAnchorKey(input.parentId, input.turnEndSeq)
    const key =
      input.fresh === true
        ? `${baseKey}:draft:${epoch}`
        : input.branchId === undefined
          ? baseKey
          : `${baseKey}:branch:${input.branchId}`
    this.setState({
      anchorKey: key,
      ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
      ...(input.excerptOffset === undefined
        ? {}
        : { excerptOffset: input.excerptOffset }),
      ...(input.frozenHistory === undefined
        ? {}
        : { frozenHistory: input.frozenHistory }),
      ...(input.mode === undefined ? {} : { mode: input.mode }),
      ...(input.sourceTurn === undefined ? {} : { sourceTurn: input.sourceTurn }),
      parentId: input.parentId,
      status: 'opening',
      turnEndSeq: input.turnEndSeq,
    })

    try {
      const children =
        input.fresh === true
          ? []
          : await this.findBranches(input.parentId, input.turnEndSeq)
      if (
        input.branchId !== undefined &&
        !children.some((branch) => branch.childId === input.branchId)
      ) {
        throw new Error(`Unknown sidecar follow-up: ${input.branchId}`)
      }
      const existingChildId =
        input.fresh === true ? undefined : (input.branchId ?? children[0]?.childId)
      if (existingChildId === undefined) {
        if (epoch === this.operationEpoch) {
          this.setState({
            anchorKey: key,
            branchIds: [],
            ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
            ...(input.excerptOffset === undefined
              ? {}
              : { excerptOffset: input.excerptOffset }),
            childAfterSeq: input.mode === 'snapshot' ? 0 : input.turnEndSeq,
            ...(input.frozenHistory === undefined
              ? {}
              : { frozenHistory: input.frozenHistory }),
            ...(input.mode === undefined ? {} : { mode: input.mode }),
            parentId: input.parentId,
            seedLength: input.seedLength,
            ...(input.sourceTurn === undefined
              ? {}
              : { sourceTurn: input.sourceTurn }),
            status: 'open',
            turnEndSeq: input.turnEndSeq,
          })
        }
        return undefined
      }

      const existingAnchor = await this.anchors.get(existingChildId)
      const excerpt = input.excerpt ?? existingAnchor?.excerpt
      const excerptOffset =
        input.excerptOffset ?? existingAnchor?.excerptOffset

      const childId = await this.forks.open({
        parentId: input.parentId,
        seedLength: input.seedLength,
        turnEndSeq: input.turnEndSeq,
        existingChildId,
      })
      await this.hideChild(
        childId,
        existingAnchor === undefined
          ? input
          : {
              ...(existingAnchor.excerpt === undefined
                ? {}
                : { excerpt: existingAnchor.excerpt }),
              ...(existingAnchor.excerptOffset === undefined
                ? {}
                : { excerptOffset: existingAnchor.excerptOffset }),
              ...(existingAnchor.mode === undefined
                ? {}
                : { mode: existingAnchor.mode }),
              parentId: existingAnchor.parentSessionId,
              seedLength: existingAnchor.seedLength,
              ...(existingAnchor.sourceTurn === undefined
                ? {}
                : { sourceTurn: existingAnchor.sourceTurn }),
              ...(existingAnchor.summary === undefined
                ? {}
                : { summary: existingAnchor.summary }),
              turnEndSeq: existingAnchor.turnEndSeq,
            },
      )
      if (epoch === this.operationEpoch) {
        this.setState({
          anchorKey: key,
          branchIds:
            input.branchId === undefined ? children.map((branch) => branch.childId) : [input.branchId],
          childId,
          childAfterSeq:
            existingAnchor?.mode === 'snapshot' ? 0 : input.turnEndSeq,
          ...(excerpt === undefined ? {} : { excerpt }),
          ...(excerptOffset === undefined ? {} : { excerptOffset }),
          ...(existingAnchor?.mode === undefined && input.mode === undefined
            ? {}
            : { mode: existingAnchor?.mode ?? input.mode }),
          parentId: input.parentId,
          seedLength: input.seedLength,
          ...(existingAnchor?.sourceTurn === undefined
            ? {}
            : { sourceTurn: existingAnchor.sourceTurn }),
          status: 'open',
          turnEndSeq: input.turnEndSeq,
        })
      }
      return childId
    } catch (error) {
      if (epoch === this.operationEpoch) {
        this.setState({
          anchorKey: key,
          error: error instanceof Error ? error.message : String(error),
          ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
          ...(input.excerptOffset === undefined
            ? {}
            : { excerptOffset: input.excerptOffset }),
          parentId: input.parentId,
          status: 'error',
          turnEndSeq: input.turnEndSeq,
        })
      }
      throw error
    }
  }

  rememberReturnFocus(target: HTMLElement): void {
    this.returnFocusTarget = target
  }

  async close(): Promise<void> {
    const epoch = ++this.operationEpoch
    const childId = this.state.childId
    if (childId !== undefined) await this.gateway.closeChildSurface(childId)
    if (epoch === this.operationEpoch) {
      this.setState({ status: 'closed' })
      const target = this.returnFocusTarget
      this.returnFocusTarget = undefined
      queueMicrotask(() => {
        if (target?.isConnected) target.focus()
      })
    }
  }

  async createBranch(): Promise<string> {
    const current = this.activeAnchor()
    const epoch = ++this.operationEpoch
    this.setState({ ...this.state, status: 'opening' })

    try {
      const childId =
        current.mode === 'snapshot'
          ? (await this.gateway.createIndependent(current.parentId)).childId
          : await this.forks.open(current)
      await this.hideChild(childId, current)
      if (epoch === this.operationEpoch) {
        this.setState({
          ...this.state,
          branchIds: [
            childId,
            ...(this.state.branchIds ?? []).filter((id) => id !== childId),
          ],
          childAfterSeq: current.mode === 'snapshot' ? 0 : current.turnEndSeq,
          childId,
          snapshotSeedPending: current.mode === 'snapshot',
          status: 'open',
        })
      }
      return childId
    } catch (error) {
      if (epoch === this.operationEpoch) {
        this.setState({
          ...this.state,
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
        })
      }
      throw error
    }
  }

  async archiveCurrentBranch(): Promise<void> {
    const current = this.activeAnchor()
    const childId = this.state.childId
    if (childId === undefined) throw new Error('No active sidecar branch')
    const branchIds = (this.state.branchIds ?? []).filter(
      (id) => id !== childId,
    )
    const nextChildId = branchIds[0]
    const epoch = ++this.operationEpoch
    let archived = false
    this.setState({ ...this.state, status: 'opening' })

    try {
      await this.workspaces.archiveSession(childId as SessionId)
      archived = true
      await this.anchors.remove(childId)
      await this.gateway.closeChildSurface(childId)
      if (epoch !== this.operationEpoch) return
      if (nextChildId === undefined) {
        this.setState({ status: 'closed' })
        return
      }

      await this.forks.open({ ...current, existingChildId: nextChildId })
      if (epoch === this.operationEpoch) {
        this.setState({
          ...this.state,
          branchIds,
          childId: nextChildId,
          status: 'open',
        })
      }
    } catch (error) {
      if (epoch === this.operationEpoch) {
        this.setState({
          ...this.state,
          ...(archived && nextChildId !== undefined
            ? {
                branchIds,
                childId: nextChildId,
              }
            : {}),
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
        })
      }
      throw error
    }
  }

  async selectBranch(childId: string): Promise<void> {
    if (!(this.state.branchIds ?? []).includes(childId)) {
      throw new Error(`Unknown sidecar branch: ${childId}`)
    }
    const current = this.activeAnchor()
    const epoch = ++this.operationEpoch
    this.setState({ ...this.state, status: 'opening' })

    try {
      await this.forks.open({ ...current, existingChildId: childId })
      await this.hideChild(childId, current)
      if (epoch === this.operationEpoch) {
        this.setState({ ...this.state, childId, status: 'open' })
      }
    } catch (error) {
      if (epoch === this.operationEpoch) {
        this.setState({
          ...this.state,
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
        })
      }
      throw error
    }
  }

  private activeAnchor(): OpenSidecarInput &
    Partial<Pick<SidecarAnchor, 'mode' | 'sourceTurn'>> {
    const { excerpt, excerptOffset, mode, parentId, seedLength, sourceTurn, turnEndSeq } =
      this.state
    if (
      parentId === undefined ||
      seedLength === undefined ||
      turnEndSeq === undefined
    ) {
      throw new Error('No active sidecar anchor')
    }
    return {
      ...(excerpt === undefined ? {} : { excerpt }),
      ...(excerptOffset === undefined ? {} : { excerptOffset }),
      ...(mode === undefined ? {} : { mode }),
      parentId,
      seedLength,
      ...(sourceTurn === undefined ? {} : { sourceTurn }),
      turnEndSeq,
    }
  }

  private async hideChild(
    childId: string,
    anchor: OpenSidecarInput & Partial<Pick<SidecarAnchor, 'mode' | 'sourceTurn'>>,
  ): Promise<void> {
    await this.anchors.put(
      childId,
      sidecarAnchor({
        ...(anchor.excerpt === undefined ? {} : { excerpt: anchor.excerpt }),
        ...(anchor.excerptOffset === undefined
          ? {}
          : { excerptOffset: anchor.excerptOffset }),
        ...(anchor.mode === undefined ? {} : { mode: anchor.mode }),
        parentSessionId: anchor.parentId,
        seedLength: anchor.seedLength,
        ...(anchor.sourceTurn === undefined
          ? {}
          : { sourceTurn: anchor.sourceTurn }),
        ...(anchor.summary === undefined ? {} : { summary: anchor.summary }),
        turnEndSeq: anchor.turnEndSeq,
      }),
    )
    if (
      !this.workspaces.list
        .getSnapshot()
        .archivedSessionIds.includes(childId as SessionId)
    ) {
      await this.workspaces.archiveSession(childId as SessionId)
    }
  }

  private async findBranches(
    parentId: string,
    turnEndSeq: number,
  ): Promise<SidecarBranchInfo[]> {
    const list = this.sessions.list.getSnapshot()
    const archived = new Set(
      this.workspaces.list.getSnapshot().archivedSessionIds,
    )
    const forkCandidates = list.ids.filter((id) => {
      const summary = list.byId[id]
      return (
        summary?.parentId === parentId &&
        summary.origin !== 'subagent'
      )
    })
    const derived = await Promise.all(
      forkCandidates.map(async (childId) => ({
        anchor: await this.anchors.get(childId),
        childId,
      })),
    )
    const listed =
      this.anchors.list === undefined ? [] : await this.anchors.list(parentId)
    const byChildId = new Map<
      string,
      { anchor: SidecarAnchor | undefined; childId: string }
    >()
    for (const record of derived) byChildId.set(record.childId, record)
    for (const record of listed) {
      byChildId.set(record.childSessionId, {
        anchor: record.anchor,
        childId: record.childSessionId,
      })
    }
    const parentSnapshot =
      typeof this.sessions.binding === 'function'
        ? this.sessions.binding(parentId as SessionId)?.session.getSnapshot()
        : undefined
    const anchors = [...byChildId.values()]

    const matches = anchors.filter(
      (entry) =>
        entry.anchor?.parentSessionId === parentId &&
        (entry.anchor.mode === 'snapshot'
          ? entry.anchor.sourceTurn !== undefined &&
            parentSnapshot?.turnEnds.get(entry.anchor.sourceTurn) === turnEndSeq
          : entry.anchor.turnEndSeq === turnEndSeq) &&
        (!archived.has(entry.childId as SessionId) || entry.anchor.hidden === true),
    )

    await Promise.all(
      matches.map(async (entry) => {
        const anchor = entry.anchor
        if (
          anchor === undefined ||
          archived.has(entry.childId as SessionId) ||
          anchor.hidden === true
        ) {
          return
        }
        await this.hideChild(entry.childId, {
          ...(anchor.excerpt === undefined ? {} : { excerpt: anchor.excerpt }),
          ...(anchor.excerptOffset === undefined
            ? {}
            : { excerptOffset: anchor.excerptOffset }),
          ...(anchor.mode === undefined ? {} : { mode: anchor.mode }),
          parentId: anchor.parentSessionId,
          seedLength: anchor.seedLength,
          ...(anchor.sourceTurn === undefined
            ? {}
            : { sourceTurn: anchor.sourceTurn }),
          ...(anchor.summary === undefined ? {} : { summary: anchor.summary }),
          turnEndSeq: anchor.turnEndSeq,
        })
      }),
    )

    return matches
      .map((entry) => branchInfoOf(entry.childId, entry.anchor, list.byId[entry.childId as SessionId]))
      .sort((left, right) => {
        const age = right.updatedAt - left.updatedAt
        return age === 0 ? left.childId.localeCompare(right.childId) : age
      })
  }

  private setState(state: SidecarControllerState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}
