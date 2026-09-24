import type { Context } from '@deepseek-ai/cordis'

import { sidecarDomainSpec } from './host/anchor-domain.js'
import {
  createAnchorFetchHandler,
  SIDECAR_RPC_PATH,
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
  const disposeRpc = ctx.connection.fetch.register({
    fetch: createAnchorFetchHandler(domain.table('anchors')),
    methods: ['POST'],
    path: SIDECAR_RPC_PATH,
    requestBody: 'buffered',
  })

  ctx.effect(
    () => async () => {
      await disposeRpc()
      await domain.close()
    },
    'dsh-sidecar: durable anchor index',
  )
}
