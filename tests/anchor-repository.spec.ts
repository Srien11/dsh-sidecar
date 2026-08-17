import { describe, expect, it, vi } from 'vitest'

import { DerivedAnchorRepository } from '../src/host/derived-anchor-repository.js'
import type { SidecarHistoryEvent } from '../src/host/derived-anchor-repository.js'

const event = (seq: number, type: string, data: unknown = {}): SidecarHistoryEvent => ({
  data,
  seq,
  type,
})

const shared = [
  event(0, 'permission/preset'),
  event(1, 'turn/start', { turn: 1 }),
  event(2, 'user/message', { text: 'question' }),
  event(3, 'step/start', { step: 1, turn: 1 }),
  event(4, 'tool/call', { callId: 'call-1' }),
  event(5, 'assistant/message', { id: 'answer-1' }),
  event(6, 'turn/end', { turn: 1 }),
  event(7, 'agent/inbox/spliced', { kind: 'steer' }),
  event(8, 'assistant/message', { id: 'answer-2' }),
  event(9, 'turn/end', { turn: 2 }),
]

describe('DerivedAnchorRepository', () => {
  it('rebuilds an anchor from the longest shared completed-turn prefix', async () => {
    const histories = new Map<string, readonly SidecarHistoryEvent[]>([
      ['parent', [...shared, event(10, 'user/message', { text: 'parent later' })]],
      ['child', [...shared, event(10, 'user/message', { text: 'child follow-up' })]],
    ])
    const repository = new DerivedAnchorRepository({
      history: async (id) => histories.get(id) ?? [],
      parentId: async (id) => (id === 'child' ? 'parent' : undefined),
    })

    await expect(repository.get('child')).resolves.toEqual({
      parentSessionId: 'parent',
      seedLength: 10,
      turnEndSeq: 9,
    })
  })

  it('returns undefined instead of inventing an anchor for missing lineage', async () => {
    const repository = new DerivedAnchorRepository({
      history: async () => shared,
      parentId: async () => undefined,
    })

    await expect(repository.get('child')).resolves.toBeUndefined()
  })

  it('rejects a put that disagrees with durable lineage', async () => {
    const repository = new DerivedAnchorRepository({
      history: async () => shared,
      parentId: async () => 'parent',
    })

    await expect(
      repository.put('child', {
        parentSessionId: 'other-parent',
        seedLength: 10,
        turnEndSeq: 9,
      }),
    ).rejects.toThrow('does not match durable Session lineage')
  })

  it('can derive the same anchor in a fresh repository instance', async () => {
    const source = {
      history: async () => shared,
      parentId: async (id: string) => (id === 'child' ? 'parent' : undefined),
    }

    const first = new DerivedAnchorRepository(source)
    const restarted = new DerivedAnchorRepository(source)

    expect(await first.get('child')).toEqual(await restarted.get('child'))
  })

  it('caches one successfully derived immutable child anchor', async () => {
    const history = async () => shared
    const source = {
      history: vi.fn(history),
      parentId: vi.fn(async (id: string) => (id === 'child' ? 'parent' : undefined)),
    }
    const repository = new DerivedAnchorRepository(source)

    await expect(repository.get('child')).resolves.toBeDefined()
    await expect(repository.get('child')).resolves.toBeDefined()

    expect(source.parentId).toHaveBeenCalledTimes(1)
    expect(source.history).toHaveBeenCalledTimes(2)
  })

  it('shares an in-flight parent history read across child derivations', async () => {
    let releaseParent!: () => void
    const parentReady = new Promise<void>((resolve) => {
      releaseParent = resolve
    })
    const source = {
      history: vi.fn(async (id: string) => {
        if (id === 'parent') await parentReady
        return shared
      }),
      parentId: vi.fn(async () => 'parent'),
    }
    const repository = new DerivedAnchorRepository(source)

    const first = repository.get('child-a')
    const second = repository.get('child-b')
    await vi.waitFor(() => expect(source.history).toHaveBeenCalledTimes(3))
    releaseParent()
    await Promise.all([first, second])

    expect(source.history.mock.calls.filter(([id]) => id === 'parent')).toHaveLength(1)
  })
})
