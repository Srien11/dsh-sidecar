import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'

import type { AnchorRepository } from '../../host/anchor-repository.js'
import type { ForkController, OpenSidecarInput } from './fork-controller.js'
import type { SidecarSessionGateway } from './session-gateway.js'

export type SidecarControllerStatus = 'closed' | 'error' | 'open' | 'opening'

export interface SidecarControllerState {
  status: SidecarControllerStatus
  anchorKey?: string
  childId?: string
  parentId?: string
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
  open(input: OpenSidecarUiInput): Promise<string>
  close(): Promise<void>
  branchCount(parentId: string, turnEndSeq: number): Promise<number>
}

function uiAnchorKey(parentId: string, turnEndSeq: number): string {
  return `${parentId}:${turnEndSeq}`
}

export class SidecarController implements SidecarUiController {
  private state: SidecarControllerState = { status: 'closed' }
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly forks: ForkController,
    private readonly gateway: SidecarSessionGateway,
    private readonly sessions: ISessions,
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

  async open(input: OpenSidecarUiInput): Promise<string> {
    const key = uiAnchorKey(input.parentId, input.turnEndSeq)
    this.setState({
      anchorKey: key,
      ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
      status: 'opening',
    })

    try {
      const children = await this.findChildren(input.parentId, input.turnEndSeq)
      const childId = await this.forks.open({
        parentId: input.parentId,
        seedLength: input.seedLength,
        turnEndSeq: input.turnEndSeq,
        ...(children[0] === undefined ? {} : { existingChildId: children[0] }),
      })
      this.setState({
        anchorKey: key,
        childId,
        ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
        parentId: input.parentId,
        status: 'open',
        turnEndSeq: input.turnEndSeq,
      })
      return childId
    } catch (error) {
      this.setState({
        anchorKey: key,
        error: error instanceof Error ? error.message : String(error),
        ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
        parentId: input.parentId,
        status: 'error',
        turnEndSeq: input.turnEndSeq,
      })
      throw error
    }
  }

  async close(): Promise<void> {
    const childId = this.state.childId
    if (childId !== undefined) await this.gateway.closeChildSurface(childId)
    this.setState({ status: 'closed' })
  }

  private async findChildren(parentId: string, turnEndSeq: number): Promise<string[]> {
    const list = this.sessions.list.getSnapshot()
    const candidates = list.ids.filter((id) => {
      const summary = list.byId[id]
      return summary?.parentId === parentId && summary.origin !== 'subagent'
    })
    const anchors = await Promise.all(
      candidates.map(async (childId) => ({
        anchor: await this.anchors.get(childId),
        childId,
      })),
    )

    return anchors
      .filter(
        (entry) =>
          entry.anchor?.parentSessionId === parentId &&
          entry.anchor.turnEndSeq === turnEndSeq,
      )
      .map((entry) => entry.childId)
      .sort()
  }

  private setState(state: SidecarControllerState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}
