import { SidecarInvariantError } from '../domain/errors.js'
import type { SidecarAnchor } from '../domain/types.js'
import type { AnchorRepository } from './anchor-repository.js'

export interface SidecarHistoryEvent {
  type: string
  seq: number
  data?: unknown
  sourceEventSeqs?: readonly number[]
  surfaceOp?: unknown
}

export interface DerivedAnchorSource {
  parentId(childSessionId: string): Promise<string | undefined>
  history(sessionId: string): Promise<readonly SidecarHistoryEvent[]>
}

function eventFingerprint(event: SidecarHistoryEvent): string {
  return JSON.stringify([
    event.seq,
    event.type,
    event.data,
    event.sourceEventSeqs,
    event.surfaceOp,
  ])
}

function deriveCompletedPrefix(
  parentEvents: readonly SidecarHistoryEvent[],
  childEvents: readonly SidecarHistoryEvent[],
): Pick<SidecarAnchor, 'seedLength' | 'turnEndSeq'> | undefined {
  const parent = [...parentEvents].sort((left, right) => left.seq - right.seq)
  const child = [...childEvents].sort((left, right) => left.seq - right.seq)
  const length = Math.min(parent.length, child.length)
  let turnEndSeq: number | undefined
  let previousSeq: number | undefined

  for (let index = 0; index < length; index += 1) {
    const parentEvent = parent[index]
    const childEvent = child[index]
    if (parentEvent === undefined || childEvent === undefined) break
    if (parentEvent.seq !== childEvent.seq) break
    if (previousSeq !== undefined && parentEvent.seq !== previousSeq + 1) break
    if (eventFingerprint(parentEvent) !== eventFingerprint(childEvent)) break

    previousSeq = parentEvent.seq
    if (parentEvent.type === 'turn/end') turnEndSeq = parentEvent.seq
  }

  return turnEndSeq === undefined
    ? undefined
    : { seedLength: turnEndSeq + 1, turnEndSeq }
}

/**
 * Cold-readable anchor repository backed only by ordinary Harness lineage and
 * Session histories. `put` validates the just-created fork; no extra record is
 * required for future reconstruction.
 */
export class DerivedAnchorRepository implements AnchorRepository {
  private readonly anchors = new Map<string, Promise<SidecarAnchor | undefined>>()
  private readonly histories = new Map<
    string,
    Promise<readonly SidecarHistoryEvent[]>
  >()

  constructor(private readonly source: DerivedAnchorSource) {}

  get(childSessionId: string): Promise<SidecarAnchor | undefined> {
    const existing = this.anchors.get(childSessionId)
    if (existing !== undefined) return existing

    const operation = this.derive(childSessionId)
    const tracked = operation.then(
      (anchor) => {
        if (anchor === undefined && this.anchors.get(childSessionId) === tracked) {
          this.anchors.delete(childSessionId)
        }
        return anchor
      },
      (error: unknown) => {
        if (this.anchors.get(childSessionId) === tracked) {
          this.anchors.delete(childSessionId)
        }
        throw error
      },
    )
    this.anchors.set(childSessionId, tracked)
    return tracked
  }

  private async derive(childSessionId: string): Promise<SidecarAnchor | undefined> {
    const parentSessionId = await this.source.parentId(childSessionId)
    if (parentSessionId === undefined || parentSessionId === childSessionId) {
      return undefined
    }

    const [parentEvents, childEvents] = await Promise.all([
      this.history(parentSessionId),
      this.history(childSessionId),
    ])
    const prefix = deriveCompletedPrefix(parentEvents, childEvents)

    return prefix === undefined ? undefined : { parentSessionId, ...prefix }
  }

  private history(sessionId: string): Promise<readonly SidecarHistoryEvent[]> {
    const existing = this.histories.get(sessionId)
    if (existing !== undefined) return existing

    const operation = this.source.history(sessionId)
    this.histories.set(sessionId, operation)
    void operation.then(
      () => {
        if (this.histories.get(sessionId) === operation) this.histories.delete(sessionId)
      },
      () => {
        if (this.histories.get(sessionId) === operation) this.histories.delete(sessionId)
      },
    )
    return operation
  }

  async put(childSessionId: string, anchor: SidecarAnchor): Promise<void> {
    const derived = await this.get(childSessionId)
    if (
      derived === undefined ||
      derived.parentSessionId !== anchor.parentSessionId ||
      derived.turnEndSeq !== anchor.turnEndSeq ||
      derived.seedLength !== anchor.seedLength
    ) {
      throw new SidecarInvariantError(
        `Anchor for ${childSessionId} does not match durable Session lineage`,
      )
    }
  }

  async remove(_childSessionId: string): Promise<void> {
    // The association is durable Harness lineage, not a plugin-owned record.
  }
}
