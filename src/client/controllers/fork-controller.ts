import { SidecarForkUncertainError } from '../../domain/errors.js'
import { sidecarAnchor } from '../../domain/anchor.js'
import type { AnchorRepository } from '../../host/anchor-repository.js'
import type { SidecarSessionGateway } from './session-gateway.js'

export interface OpenSidecarInput {
  excerpt?: string
  excerptOffset?: number
  parentId: string
  summary?: string
  turnEndSeq: number
  seedLength: number
  existingChildId?: string
}

export class ForkController {
  private readonly inflight = new Map<string, Promise<string>>()
  private readonly createdChildren = new Map<string, string>()
  private readonly uncertain = new Map<string, SidecarForkUncertainError>()

  constructor(
    private readonly gateway: SidecarSessionGateway,
    private readonly anchors: AnchorRepository,
  ) {}

  open(input: OpenSidecarInput): Promise<string> {
    if (input.existingChildId !== undefined) {
      return this.openExisting(input.existingChildId)
    }

    const key = `${input.parentId}:${input.turnEndSeq}`
    const uncertain = this.uncertain.get(key)
    if (uncertain !== undefined) return Promise.reject(uncertain)
    const existing = this.inflight.get(key)
    if (existing !== undefined) return existing

    const operation = this.create(key, input)
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

  private async create(key: string, input: OpenSidecarInput): Promise<string> {
    let childId = this.createdChildren.get(key)
    if (childId === undefined) {
      try {
        const forked = await this.gateway.fork({
          atSeq: input.turnEndSeq,
          sessionId: input.parentId,
        })
        childId = forked.childId
        // From this point onward the outcome is known. Keep the id until every
        // setup step succeeds so a retry resumes instead of copying again.
        this.createdChildren.set(key, childId)
      } catch (error) {
        const uncertain =
          error instanceof SidecarForkUncertainError
            ? error
            : new SidecarForkUncertainError()
        this.uncertain.set(key, uncertain)
        throw uncertain
      }
    }

    try {
      const anchor = sidecarAnchor({
        ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
        ...(input.excerptOffset === undefined
          ? {}
          : { excerptOffset: input.excerptOffset }),
        parentSessionId: input.parentId,
        seedLength: input.seedLength,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        turnEndSeq: input.turnEndSeq,
      })
      await this.anchors.put(childId, anchor)
      this.createdChildren.delete(key)
      return childId
    } catch (error) {
      // The child id is already durable and retained above. Surface the real
      // setup error; the next attempt will resume this exact child.
      throw error
    }
  }

  private clear(key: string, operation: Promise<string>): void {
    if (this.inflight.get(key) === operation) this.inflight.delete(key)
  }
}
