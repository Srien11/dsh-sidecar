import { describe, expect, it, vi } from 'vitest'

import { createAnchorRpcHandler } from '../src/host/anchor-rpc.js'

const anchor = {
  parentSessionId: 'parent',
  seedLength: 11,
  turnEndSeq: 10,
}

describe('sidecar anchor RPC', () => {
  it('round-trips explicit records through the domain table', async () => {
    const records = new Map<string, typeof anchor>()
    const table = {
      delete: vi.fn(async (key: string) => records.delete(key)),
      get: vi.fn((key: string) => records.get(key)),
      put: vi.fn(async (key: string, value: typeof anchor) => {
        records.set(key, value)
      }),
    }
    const handle = createAnchorRpcHandler(table)
    const signal = new AbortController().signal

    await expect(
      handle('anchors/put', { anchor, childSessionId: 'child' }, signal),
    ).resolves.toEqual({ ok: true, value: null })
    await expect(
      handle('anchors/get', { childSessionId: 'child' }, signal),
    ).resolves.toEqual({ ok: true, value: anchor })
    await expect(
      handle('anchors/remove', { childSessionId: 'child' }, signal),
    ).resolves.toEqual({ ok: true, value: null })
    await expect(
      handle('anchors/get', { childSessionId: 'child' }, signal),
    ).resolves.toEqual({ ok: true, value: null })
  })

  it('rejects malformed payloads without echoing their values', async () => {
    const handle = createAnchorRpcHandler({
      delete: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    })

    await expect(
      handle(
        'anchors/put',
        { anchor: { ...anchor, turnEndSeq: -1 }, childSessionId: 'secret-child' },
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      error: {
        code: 'internal',
        details: {},
        message: 'Invalid sidecar anchor request',
      },
      ok: false,
    })
  })
})
