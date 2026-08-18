import { SidecarForkUncertainError } from '../../domain/errors.js'
import type { SidecarAnchor } from '../../domain/types.js'
import type { AnchorRepository } from '../../host/anchor-repository.js'
import type { SidecarSessionGateway } from './session-gateway.js'

export interface OpenSidecarInput {
  parentId: string
  turnEndSeq: number
  seedLength: number
  existingChildId?: string
}

export class ForkController {
  private readonly inflight = new Map<string, Promise<string>>()

  constructor(
    private readonly gateway: SidecarSessionGateway,
    private readonly anchors: AnchorRepository,
  ) {}

  open(input: OpenSidecarInput): Promise<string> {
    if (input.existingChildId !== undefined) {
      return this.openExisting(input.existingChildId)
    }

    const key = `${input.parentId}:${input.turnEndSeq}`
    const existing = this.inflight.get(key)
    if (existing !== undefined) return existing

    const operation = this.create(input)
    this.inflight.set(key, operation)
    void operation.then(
      () => this.clear(key, operation),
      () => this.clear(key, operation),
    )
    return operation
  }

  private async openExisting(childId: string): Promise<string> {
    await this.gateway.openChildSurface(childId)
    return childId
  }

  private async create(input: OpenSidecarInput): Promise<string> {
    try {
      const { childId } = await this.gateway.fork({
        atSeq: input.turnEndSeq,
        sessionId: input.parentId,
      })
      await this.gateway.openChildSurface(childId)

      const anchor: SidecarAnchor = {
        hidden: true,
        parentSessionId: input.parentId,
        seedLength: input.seedLength,
        turnEndSeq: input.turnEndSeq,
      }
      await this.anchors.put(childId, anchor)
      return childId
    } catch (error) {
      if (error instanceof SidecarForkUncertainError) throw error
      throw new SidecarForkUncertainError()
    }
  }

  private clear(key: string, operation: Promise<string>): void {
    if (this.inflight.get(key) === operation) this.inflight.delete(key)
  }
}
