import { describe, expect, it, vi } from 'vitest'

import { ForkController } from '../src/client/controllers/fork-controller.js'
import type { SidecarSessionGateway } from '../src/client/controllers/session-gateway.js'
import type { AnchorRepository } from '../src/host/anchor-repository.js'

function harness() {
  let resolveFork: ((value: { childId: string }) => void) | undefined
  const gateway: SidecarSessionGateway = {
    cancel: vi.fn(),
    closeChildSurface: vi.fn(),
    fork: vi.fn(
      () =>
        new Promise<{ childId: string }>((resolve) => {
          resolveFork = resolve
        }),
    ),
    openChildSurface: vi.fn().mockResolvedValue(undefined),
    prompt: vi.fn(),
    rename: vi.fn(),
  }
  const anchors: AnchorRepository = {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  }

  return {
    anchors,
    controller: new ForkController(gateway, anchors),
    gateway,
    resolveFork: (childId = 'child') => resolveFork?.({ childId }),
  }
}

describe('ForkController', () => {
  it('passes the exact parent and answer boundary without navigating', async () => {
    const test = harness()
    const result = test.controller.open({
      parentId: 'parent',
      seedLength: 43,
      turnEndSeq: 42,
    })
    test.resolveFork()

    await expect(result).resolves.toBe('child')
    expect(test.gateway.fork).toHaveBeenCalledWith({
      atSeq: 42,
      sessionId: 'parent',
    })
    expect(test.gateway.openChildSurface).toHaveBeenCalledWith('child')
  })

  it('records the anchor only after the child surface is addressable', async () => {
    const test = harness()
    const order: string[] = []
    vi.mocked(test.gateway.openChildSurface).mockImplementation(async () => {
      order.push('addressable')
    })
    vi.mocked(test.anchors.put).mockImplementation(async () => {
      order.push('recorded')
    })
    const result = test.controller.open({
      parentId: 'parent',
      seedLength: 43,
      turnEndSeq: 42,
    })
    test.resolveFork()
    await result

    expect(order).toEqual(['addressable', 'recorded'])
    expect(test.anchors.put).toHaveBeenCalledWith('child', {
      parentSessionId: 'parent',
      seedLength: 43,
      turnEndSeq: 42,
    })
  })

  it('deduplicates one in-flight fork per answer anchor', async () => {
    const test = harness()
    const input = { parentId: 'parent', seedLength: 43, turnEndSeq: 42 }

    const first = test.controller.open(input)
    const second = test.controller.open(input)

    expect(first).toBe(second)
    expect(test.gateway.fork).toHaveBeenCalledTimes(1)
    test.resolveFork()
    await first
  })

  it('opens an existing child without forking again', async () => {
    const test = harness()

    await expect(
      test.controller.open({
        existingChildId: 'existing',
        parentId: 'parent',
        seedLength: 43,
        turnEndSeq: 42,
      }),
    ).resolves.toBe('existing')

    expect(test.gateway.fork).not.toHaveBeenCalled()
    expect(test.gateway.openChildSurface).toHaveBeenCalledWith('existing')
  })

  it('does not retry an uncertain failure', async () => {
    const gateway: SidecarSessionGateway = {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn().mockRejectedValue(new Error('connection reset')),
      openChildSurface: vi.fn(),
      prompt: vi.fn(),
      rename: vi.fn(),
    }
    const anchors: AnchorRepository = {
      get: vi.fn(),
      put: vi.fn(),
      remove: vi.fn(),
    }
    const controller = new ForkController(gateway, anchors)

    await expect(
      controller.open({ parentId: 'parent', seedLength: 43, turnEndSeq: 42 }),
    ).rejects.toThrow('Check existing branches before retrying')
    expect(gateway.fork).toHaveBeenCalledTimes(1)
  })
})
