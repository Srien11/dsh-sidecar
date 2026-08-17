import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

import { apply } from '../src/index.js'
import { SIDECAR_RPC_CHANNEL } from '../src/domain/rpc.js'
import { sidecarDomainSpec } from '../src/host/anchor-domain.js'

describe('dsh-sidecar host plugin', () => {
  it('mounts and disposes the durable anchor channel', async () => {
    const order: string[] = []
    const table = {
      delete: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    }
    const domain = {
      close: vi.fn(async () => {
        order.push('domain')
      }),
      table: vi.fn(() => table),
    }
    const disposeRpc = vi.fn(async () => {
      order.push('rpc')
    })
    let dispose: (() => Promise<void>) | undefined
    const ctx = {
      connection: {
        rpc: {
          handle: vi.fn(() => disposeRpc),
        },
      },
      effect: vi.fn((setup: () => () => Promise<void>) => {
        dispose = setup()
      }),
      storageDomain: {
        open: vi.fn(async () => domain),
      },
    } as unknown as Context

    await apply(ctx)

    expect(ctx.storageDomain.open).toHaveBeenCalledWith(sidecarDomainSpec)
    expect(domain.table).toHaveBeenCalledWith('anchors')
    expect(ctx.connection.rpc.handle).toHaveBeenCalledWith(
      SIDECAR_RPC_CHANNEL,
      expect.any(Function),
      { authority: 'trusted-host' },
    )

    await dispose?.()
    expect(order).toEqual(['rpc', 'domain'])
  })
})
