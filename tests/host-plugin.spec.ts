import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

import { apply, inject } from '../src/index.js'
import { SIDECAR_RPC_PATH } from '../src/domain/rpc.js'
import { sidecarDomainSpec } from '../src/host/anchor-domain.js'

describe('dsh-sidecar host plugin', () => {
  it('declares every service used by the host RPC registration', () => {
    expect(inject).toEqual(['connection', 'storageDomain'])
  })

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
        fetch: {
          register: vi.fn(() => disposeRpc),
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
    expect(ctx.connection.fetch.register).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      methods: ['POST'],
      path: SIDECAR_RPC_PATH,
      requestBody: 'buffered',
    })

    await dispose?.()
    expect(order).toEqual(['rpc', 'domain'])
  })
})
