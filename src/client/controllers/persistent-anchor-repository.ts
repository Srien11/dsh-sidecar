import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'

import { SIDECAR_RPC_CHANNEL } from '../../domain/rpc.js'
import type { SidecarAnchor, SidecarAnchorRecord } from '../../domain/types.js'
import type { AnchorRepository } from '../../host/anchor-repository.js'

const LOCAL_ANCHOR_PREFIX = 'dsh-sidecar:anchor:'
const LOCAL_ANCHOR_INDEX = 'dsh-sidecar:anchor:index'

interface LocalAnchorStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAnchor(value: unknown): value is SidecarAnchor {
  return (
    isRecord(value) &&
    (value.excerpt === undefined ||
      (typeof value.excerpt === 'string' && value.excerpt.length > 0)) &&
    (value.excerptOffset === undefined ||
      (Number.isInteger(value.excerptOffset) &&
        (value.excerptOffset as number) >= 0)) &&
    (value.hidden === undefined || value.hidden === true) &&
    (value.mode === undefined || value.mode === 'fork' || value.mode === 'snapshot') &&
    typeof value.parentSessionId === 'string' &&
    Number.isInteger(value.seedLength) &&
    (value.sourceTurn === undefined ||
      (Number.isInteger(value.sourceTurn) && (value.sourceTurn as number) >= 0)) &&
    (value.summary === undefined ||
      (typeof value.summary === 'string' && value.summary.length > 0)) &&
    Number.isInteger(value.turnEndSeq) &&
    (value.seedLength as number) >= 0 &&
    (value.turnEndSeq as number) >= 0
  )
}

function defaultLocalStorage(): LocalAnchorStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export class PersistentAnchorRepository implements AnchorRepository {
  constructor(
    private readonly rpc: ClientConnectionRpc,
    private readonly local: LocalAnchorStorage | undefined = defaultLocalStorage(),
  ) {}

  async get(childSessionId: string): Promise<SidecarAnchor | undefined> {
    const local = this.readLocal(childSessionId)
    try {
      const value = await this.call('Reading sidecar anchor', 'anchors/get', {
        childSessionId,
      })
      if (value === null) return local
      if (!isAnchor(value)) {
        throw new Error('Reading sidecar anchor returned invalid data')
      }
      this.writeLocal(childSessionId, value)
      return value
    } catch (error) {
      if (local !== undefined) return local
      throw error
    }
  }

  async list(parentSessionId?: string): Promise<readonly SidecarAnchorRecord[]> {
    const local = this.listLocal(parentSessionId)
    try {
      const value = await this.call('Listing sidecar anchors', 'anchors/list', {
        ...(parentSessionId === undefined ? {} : { parentSessionId }),
      })
      if (!Array.isArray(value)) {
        throw new Error('Listing sidecar anchors returned invalid data')
      }
      const records = new Map(
        local.map((record) => [record.childSessionId, record]),
      )
      for (const item of value) {
        if (
          !isRecord(item) ||
          typeof item.childSessionId !== 'string' ||
          !isAnchor(item.anchor)
        ) {
          throw new Error('Listing sidecar anchors returned invalid data')
        }
        records.set(item.childSessionId, {
          anchor: item.anchor,
          childSessionId: item.childSessionId,
        })
        this.writeLocal(item.childSessionId, item.anchor)
      }
      return [...records.values()]
    } catch (error) {
      if (local.length > 0) return local
      throw error
    }
  }

  async put(childSessionId: string, anchor: SidecarAnchor): Promise<void> {
    const locallyRecorded = this.writeLocal(childSessionId, anchor)
    try {
      await this.call('Writing sidecar anchor', 'anchors/put', {
        anchor,
        childSessionId,
      })
    } catch (error) {
      if (!locallyRecorded) throw error
      console.warn('dsh-sidecar: host anchor write failed; using local backup', error)
    }
  }

  async remove(childSessionId: string): Promise<void> {
    const locallyRemoved = this.removeLocal(childSessionId)
    try {
      await this.call('Removing sidecar anchor', 'anchors/remove', {
        childSessionId,
      })
    } catch (error) {
      if (!locallyRemoved) throw error
      console.warn('dsh-sidecar: host anchor removal failed; local backup removed', error)
    }
  }

  private localKey(childSessionId: string): string {
    return `${LOCAL_ANCHOR_PREFIX}${childSessionId}`
  }

  private readLocal(childSessionId: string): SidecarAnchor | undefined {
    if (this.local === undefined) return undefined
    try {
      const serialized = this.local.getItem(this.localKey(childSessionId))
      if (serialized === null) return undefined
      const value: unknown = JSON.parse(serialized)
      if (!isAnchor(value)) {
        this.local.removeItem(this.localKey(childSessionId))
        return undefined
      }
      return value
    } catch {
      return undefined
    }
  }

  private writeLocal(childSessionId: string, anchor: SidecarAnchor): boolean {
    if (this.local === undefined) return false
    try {
      this.local.setItem(this.localKey(childSessionId), JSON.stringify(anchor))
      const ids = this.readLocalIndex()
      if (!ids.includes(childSessionId)) {
        this.local.setItem(
          LOCAL_ANCHOR_INDEX,
          JSON.stringify([...ids, childSessionId]),
        )
      }
      return true
    } catch {
      return false
    }
  }

  private removeLocal(childSessionId: string): boolean {
    if (this.local === undefined) return false
    try {
      this.local.removeItem(this.localKey(childSessionId))
      this.local.setItem(
        LOCAL_ANCHOR_INDEX,
        JSON.stringify(this.readLocalIndex().filter((id) => id !== childSessionId)),
      )
      return true
    } catch {
      return false
    }
  }

  private listLocal(parentSessionId?: string): SidecarAnchorRecord[] {
    return this.readLocalIndex().flatMap((childSessionId) => {
      const anchor = this.readLocal(childSessionId)
      return anchor !== undefined &&
        (parentSessionId === undefined || anchor.parentSessionId === parentSessionId)
        ? [{ anchor, childSessionId }]
        : []
    })
  }

  private readLocalIndex(): string[] {
    if (this.local === undefined) return []
    try {
      const serialized = this.local.getItem(LOCAL_ANCHOR_INDEX)
      if (serialized === null) return []
      const value: unknown = JSON.parse(serialized)
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : []
    } catch {
      return []
    }
  }

  private async call(
    operation: string,
    endpoint: string,
    payload: unknown,
  ): Promise<unknown> {
    const result = await this.rpc.call(SIDECAR_RPC_CHANNEL, endpoint, payload)
    if (!result.ok) {
      throw new Error(`${operation} failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
}
