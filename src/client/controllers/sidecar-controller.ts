import type {
  ISessions,
  IWorkspaces,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'

import type { AnchorRepository } from '../../host/anchor-repository.js'
import type { ForkController, OpenSidecarInput } from './fork-controller.js'
import type { SidecarSessionGateway } from './session-gateway.js'

export type SidecarControllerStatus = 'closed' | 'error' | 'open' | 'opening'

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
}

export type OpenSidecarUiInput = Omit<OpenSidecarInput, 'existingChildId'> & {
  excerpt?: string
}

export interface SidecarUiController {
  getSnapshot(): SidecarControllerState
  subscribe(listener: () => void): () => void
  open(input: OpenSidecarUiInput): Promise<string | undefined>
  close(): Promise<void>
  branchCount(parentId: string, turnEndSeq: number): Promise<number>
  prompt(text: string): Promise<void>
  archiveCurrentBranch(): Promise<void>
  createBranch(): Promise<string>
  rememberReturnFocus(target: HTMLElement): void
  selectBranch(childId: string): Promise<void>
}

function uiAnchorKey(parentId: string, turnEndSeq: number): string {
  return `${parentId}:${turnEndSeq}`
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
    const matches = await this.findChildren(parentId, turnEndSeq)
    return matches.length
  }

  async prompt(text: string): Promise<void> {
    const currentChildId = this.state.childId
    if (currentChildId !== undefined) {
      await this.gateway.prompt(currentChildId, text)
      return
    }

    const anchor = this.activeAnchor()
    const key = uiAnchorKey(anchor.parentId, anchor.turnEndSeq)
    const prepared = this.preparedChildren.get(key)
    const childId = prepared ?? (await this.forks.open(anchor))
    this.preparedChildren.set(key, childId)
    await this.hideChild(childId, anchor)
    await this.gateway.prompt(childId, text)
    this.preparedChildren.delete(key)

    if (this.state.status === 'open' && this.state.anchorKey === key) {
      const { excerpt: _excerpt, ...state } = this.state
      this.setState({
        ...state,
        branchIds: [
          childId,
          ...(state.branchIds ?? []).filter((id) => id !== childId),
        ],
        childId,
      })
    }
  }

  async open(input: OpenSidecarUiInput): Promise<string | undefined> {
    const epoch = ++this.operationEpoch
    const key = uiAnchorKey(input.parentId, input.turnEndSeq)
    this.setState({
      anchorKey: key,
      ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
      status: 'opening',
    })

    try {
      const children = await this.findChildren(input.parentId, input.turnEndSeq)
      const existingChildId = children[0]
      if (existingChildId === undefined) {
        if (epoch === this.operationEpoch) {
          this.setState({
            anchorKey: key,
            branchIds: [],
            ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
            parentId: input.parentId,
            seedLength: input.seedLength,
            status: 'open',
            turnEndSeq: input.turnEndSeq,
          })
        }
        return undefined
      }

      const childId = await this.forks.open({
        parentId: input.parentId,
        seedLength: input.seedLength,
        turnEndSeq: input.turnEndSeq,
        existingChildId,
      })
      await this.hideChild(childId, input)
      if (epoch === this.operationEpoch) {
        this.setState({
          anchorKey: key,
          branchIds: children,
          childId,
          ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
          parentId: input.parentId,
          seedLength: input.seedLength,
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
      const childId = await this.forks.open(current)
      await this.hideChild(childId, current)
      if (epoch === this.operationEpoch) {
        this.setState({
          ...this.state,
          branchIds: [
            childId,
            ...(this.state.branchIds ?? []).filter((id) => id !== childId),
          ],
          childId,
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

  private activeAnchor(): OpenSidecarInput {
    const { parentId, seedLength, turnEndSeq } = this.state
    if (
      parentId === undefined ||
      seedLength === undefined ||
      turnEndSeq === undefined
    ) {
      throw new Error('No active sidecar anchor')
    }
    return { parentId, seedLength, turnEndSeq }
  }

  private async hideChild(
    childId: string,
    anchor: OpenSidecarInput,
  ): Promise<void> {
    await this.anchors.put(childId, {
      hidden: true,
      parentSessionId: anchor.parentId,
      seedLength: anchor.seedLength,
      turnEndSeq: anchor.turnEndSeq,
    })
    if (
      !this.workspaces.list
        .getSnapshot()
        .archivedSessionIds.includes(childId as SessionId)
    ) {
      await this.workspaces.archiveSession(childId as SessionId)
    }
  }

  private async findChildren(parentId: string, turnEndSeq: number): Promise<string[]> {
    const list = this.sessions.list.getSnapshot()
    const archived = new Set(
      this.workspaces.list.getSnapshot().archivedSessionIds,
    )
    const candidates = list.ids.filter((id) => {
      const summary = list.byId[id]
      return (
        summary?.parentId === parentId &&
        summary.origin !== 'subagent'
      )
    })
    const anchors = await Promise.all(
      candidates.map(async (childId) => ({
        anchor: await this.anchors.get(childId),
        childId,
      })),
    )

    const matches = anchors.filter(
      (entry) =>
        entry.anchor?.parentSessionId === parentId &&
        entry.anchor.turnEndSeq === turnEndSeq &&
        (!archived.has(entry.childId) || entry.anchor.hidden === true),
    )

    await Promise.all(
      matches.map(async (entry) => {
        const anchor = entry.anchor
        if (
          anchor === undefined ||
          archived.has(entry.childId) ||
          anchor.hidden === true
        ) {
          return
        }
        await this.hideChild(entry.childId, {
          parentId: anchor.parentSessionId,
          seedLength: anchor.seedLength,
          turnEndSeq: anchor.turnEndSeq,
        })
      }),
    )

    return matches
      .map((entry) => entry.childId)
      .sort((left, right) => {
        const age =
          (list.byId[right]?.updatedAt ?? 0) -
          (list.byId[left]?.updatedAt ?? 0)
        return age === 0 ? left.localeCompare(right) : age
      })
  }

  private setState(state: SidecarControllerState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}
