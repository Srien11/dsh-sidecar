import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type { RpcResult } from '@deepseek-ai/dsh-client-connection/client'
import { z } from 'zod'

import type { SidecarAnchor, SidecarAnchorRecord } from '../domain/types.js'
import { SIDECAR_RPC_CHANNEL } from '../domain/rpc.js'
import { sidecarAnchorSchema } from './anchor-domain.js'

export { SIDECAR_RPC_CHANNEL }

export interface SidecarAnchorTable {
  get(key: string): SidecarAnchor | undefined
  entries(): IterableIterator<[string, SidecarAnchor]>
  put(key: string, value: SidecarAnchor): Promise<void>
  delete(key: string): Promise<boolean>
}

const childRequestSchema = z.object({ childSessionId: z.string().min(1) }).strict()
const listRequestSchema = z
  .object({ parentSessionId: z.string().min(1).optional() })
  .strict()
const putRequestSchema = childRequestSchema
  .extend({ anchor: sidecarAnchorSchema })
  .strict()

function invalidRequest(): RpcResult<unknown> {
  return {
    error: {
      code: 'internal',
      details: {},
      message: 'Invalid sidecar anchor request',
    },
    ok: false,
  }
}

export function createAnchorRpcHandler(table: SidecarAnchorTable): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    if (endpoint === 'anchors/list') {
      const parsed = listRequestSchema.safeParse(payload)
      if (!parsed.success) return invalidRequest()
      const records: SidecarAnchorRecord[] = []
      for (const [childSessionId, anchor] of table.entries()) {
        if (
          parsed.data.parentSessionId === undefined ||
          anchor.parentSessionId === parsed.data.parentSessionId
        ) {
          records.push({ anchor, childSessionId })
        }
      }
      return { ok: true, value: records }
    }

    if (endpoint === 'anchors/put') {
      const parsed = putRequestSchema.safeParse(payload)
      if (!parsed.success) return invalidRequest()
      await table.put(parsed.data.childSessionId, parsed.data.anchor)
      return { ok: true, value: null }
    }

    const parsed = childRequestSchema.safeParse(payload)
    if (!parsed.success) return invalidRequest()

    if (endpoint === 'anchors/get') {
      return {
        ok: true,
        value: table.get(parsed.data.childSessionId) ?? null,
      }
    }
    if (endpoint === 'anchors/remove') {
      await table.delete(parsed.data.childSessionId)
      return { ok: true, value: null }
    }
    return invalidRequest()
  }
}
