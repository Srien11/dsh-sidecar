import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PersistentAnchorRepository } from '../src/client/controllers/persistent-anchor-repository.js'

const anchor = {
  parentSessionId: 'parent',
  seedLength: 11,
  turnEndSeq: 10,
}

describe('PersistentAnchorRepository', () => {
  beforeEach(() => localStorage.clear())

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

  it('lists snapshot anchors by parent for restart recovery', async () => {
    const snapshotAnchor = {
      ...anchor,
      mode: 'snapshot' as const,
      sourceTurn: 3,
    }
    const rpc = {
      call: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ anchor: snapshotAnchor, childSessionId: 'snapshot-child' }],
      }),
    } as unknown as ClientConnectionRpc
    const repository = new PersistentAnchorRepository(rpc)

    await expect(repository.list('parent')).resolves.toEqual([
      { anchor: snapshotAnchor, childSessionId: 'snapshot-child' },
    ])
    expect(rpc.call).toHaveBeenCalledWith('/dsh-sidecar', 'anchors/list', {
      parentSessionId: 'parent',
    })
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

  it('uses the browser-local backup when the host channel is unavailable', async () => {
    const rpc = {
      call: vi.fn().mockResolvedValue({
        error: { code: 'internal', details: {}, message: 'channel unavailable' },
        ok: false,
      }),
    } as unknown as ClientConnectionRpc
    const repository = new PersistentAnchorRepository(rpc)

    await expect(repository.put('child', anchor)).resolves.toBeUndefined()
    await expect(repository.get('child')).resolves.toEqual(anchor)
    await expect(repository.remove('child')).resolves.toBeUndefined()
    await expect(repository.get('child')).rejects.toThrow('channel unavailable')
  })
})
