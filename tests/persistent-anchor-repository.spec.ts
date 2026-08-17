import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { describe, expect, it, vi } from 'vitest'

import { PersistentAnchorRepository } from '../src/client/controllers/persistent-anchor-repository.js'

const anchor = {
  parentSessionId: 'parent',
  seedLength: 11,
  turnEndSeq: 10,
}

describe('PersistentAnchorRepository', () => {
  it('reads only an explicitly recorded sidecar anchor', async () => {
    const rpc = {
      call: vi.fn().mockResolvedValue({ ok: true, value: anchor }),
    } as unknown as ClientConnectionRpc
    const repository = new PersistentAnchorRepository(rpc)

    await expect(repository.get('child')).resolves.toEqual(anchor)
    expect(rpc.call).toHaveBeenCalledWith('/dsh-sidecar', 'anchors/get', {
      childSessionId: 'child',
    })
  })

  it('does not invent an anchor for an ordinary fork', async () => {
    const rpc = {
      call: vi.fn().mockResolvedValue({ ok: true, value: null }),
    } as unknown as ClientConnectionRpc
    const repository = new PersistentAnchorRepository(rpc)

    await expect(repository.get('ordinary-fork')).resolves.toBeUndefined()
  })

  it('persists and removes sidecar identity through the host channel', async () => {
    const rpc = {
      call: vi.fn().mockResolvedValue({ ok: true, value: null }),
    } as unknown as ClientConnectionRpc
    const repository = new PersistentAnchorRepository(rpc)

    await repository.put('child', anchor)
    await repository.remove('child')

    expect(rpc.call).toHaveBeenNthCalledWith(1, '/dsh-sidecar', 'anchors/put', {
      anchor,
      childSessionId: 'child',
    })
    expect(rpc.call).toHaveBeenNthCalledWith(2, '/dsh-sidecar', 'anchors/remove', {
      childSessionId: 'child',
    })
  })

  it('surfaces host failures without accepting malformed identity', async () => {
    const rpc = {
      call: vi.fn().mockResolvedValue({
        error: { code: 'internal', details: {}, message: 'storage unavailable' },
        ok: false,
      }),
    } as unknown as ClientConnectionRpc
    const repository = new PersistentAnchorRepository(rpc)

    await expect(repository.get('child')).rejects.toThrow(
      'Reading sidecar anchor failed: internal: storage unavailable',
    )
  })
})
