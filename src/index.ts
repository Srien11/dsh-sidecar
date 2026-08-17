import type { Context } from '@deepseek-ai/cordis'

import { sidecarDomainSpec } from './host/anchor-domain.js'
import {
  createAnchorRpcHandler,
  SIDECAR_RPC_CHANNEL,
} from './host/anchor-rpc.js'

export const name = 'dsh-sidecar'
export const inject = ['connection', 'storageDomain']

/**
 * Host half of dsh-sidecar.
 *
 * Sidecar conversations remain ordinary Harness Sessions. This Host half owns
 * only the small durable identity index that distinguishes them from ordinary
 * Session forks.
 */
export async function apply(ctx: Context): Promise<void> {
  const domain = await ctx.storageDomain.open(sidecarDomainSpec)
  const disposeRpc = ctx.connection.rpc.handle(
    SIDECAR_RPC_CHANNEL,
    createAnchorRpcHandler(domain.table('anchors')),
    { authority: 'trusted-host' },
  )

  ctx.effect(
    () => async () => {
      await disposeRpc()
      await domain.close()
    },
    'dsh-sidecar: durable anchor index',
  )
}
