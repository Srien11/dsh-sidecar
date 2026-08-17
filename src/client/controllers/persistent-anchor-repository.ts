import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'

import { SIDECAR_RPC_CHANNEL } from '../../domain/rpc.js'
import type { SidecarAnchor } from '../../domain/types.js'
import type { AnchorRepository } from '../../host/anchor-repository.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAnchor(value: unknown): value is SidecarAnchor {
  return (
    isRecord(value) &&
    typeof value.parentSessionId === 'string' &&
    Number.isInteger(value.seedLength) &&
    Number.isInteger(value.turnEndSeq) &&
    (value.seedLength as number) >= 0 &&
    (value.turnEndSeq as number) >= 0
  )
}

export class PersistentAnchorRepository implements AnchorRepository {
  constructor(private readonly rpc: ClientConnectionRpc) {}

  async get(childSessionId: string): Promise<SidecarAnchor | undefined> {
    const value = await this.call('Reading sidecar anchor', 'anchors/get', {
      childSessionId,
    })
    if (value === null) return undefined
    if (!isAnchor(value)) throw new Error('Reading sidecar anchor returned invalid data')
    return value
  }

  async put(childSessionId: string, anchor: SidecarAnchor): Promise<void> {
    await this.call('Writing sidecar anchor', 'anchors/put', {
      anchor,
      childSessionId,
    })
  }

  async remove(childSessionId: string): Promise<void> {
    await this.call('Removing sidecar anchor', 'anchors/remove', { childSessionId })
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
