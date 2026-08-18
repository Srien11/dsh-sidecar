import { describe, expect, it, vi } from 'vitest'

import type { AnchorRepository } from '../src/host/anchor-repository.js'
import type { ForkController, OpenSidecarInput } from '../src/client/controllers/fork-controller.js'
import type { SidecarSessionGateway } from '../src/client/controllers/session-gateway.js'
import { SidecarController } from '../src/client/controllers/sidecar-controller.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

function harness(
  open: (input: OpenSidecarInput) => Promise<string>,
  list = { byId: {}, ids: [] as string[] },
  archivedSessionIds: string[] = [],
) {
  const forks = { open: vi.fn(open) } as unknown as ForkController
  const gateway: SidecarSessionGateway = {
    cancel: vi.fn(),
    closeChildSurface: vi.fn().mockResolvedValue(undefined),
    fork: vi.fn(),
    openChildSurface: vi.fn(),
    prompt: vi.fn(),
    rename: vi.fn(),
  }
  const anchors: AnchorRepository = {
    get: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
  }
  const sessions = {
    list: {
      getSnapshot: () => list,
    },
  }
  const workspaces = {
    list: {
      getSnapshot: () => ({ archivedSessionIds }),
    },
  }

  return {
    controller: new SidecarController(
      forks,
      gateway,
      sessions as never,
      workspaces as never,
      anchors,
    ),
    anchors,
    forks,
    gateway,
  }
}

const input = (parentId: string, turnEndSeq: number) => ({
  parentId,
  seedLength: turnEndSeq + 1,
  turnEndSeq,
})

describe('SidecarController operation ordering', () => {
  it('does not let an older open completion replace the latest target', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const test = harness((request) =>
      request.parentId === 'parent-a' ? first.promise : second.promise,
    )

    const openingA = test.controller.open(input('parent-a', 10))
    await vi.waitFor(() => expect(test.forks.open).toHaveBeenCalledTimes(1))
    const openingB = test.controller.open(input('parent-b', 20))
    await vi.waitFor(() => expect(test.forks.open).toHaveBeenCalledTimes(2))

    second.resolve('child-b')
    await openingB
    first.resolve('child-a')
    await openingA

    expect(test.controller.getSnapshot()).toMatchObject({
      childId: 'child-b',
      parentId: 'parent-b',
      status: 'open',
      turnEndSeq: 20,
    })
  })

  it('stays closed when an in-flight open completes after close', async () => {
    const pending = deferred<string>()
    const test = harness(() => pending.promise)

    const opening = test.controller.open(input('parent', 10))
    await vi.waitFor(() => expect(test.forks.open).toHaveBeenCalledTimes(1))
    await test.controller.close()

    pending.resolve('child')
    await opening

    expect(test.controller.getSnapshot()).toEqual({ status: 'closed' })
  })
})

describe('SidecarController branch identity', () => {
  it('does not count an unrecorded ordinary Harness fork as a sidecar', async () => {
    const test = harness(async () => 'child', {
      byId: { ordinary: { parentId: 'parent' } },
      ids: ['ordinary'],
    })
    vi.mocked(test.anchors.get).mockResolvedValue(undefined)

    await expect(test.controller.branchCount('parent', 10)).resolves.toBe(0)
    expect(test.anchors.get).toHaveBeenCalledWith('ordinary')
  })

  it('does not count an archived sidecar branch', async () => {
    const test = harness(
      async () => 'new-child',
      {
        byId: { archived: { parentId: 'parent' } },
        ids: ['archived'],
      },
      ['archived'],
    )
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await expect(test.controller.branchCount('parent', 10)).resolves.toBe(0)
    expect(test.anchors.get).not.toHaveBeenCalled()
  })

  it('creates a new branch instead of restoring an archived sidecar', async () => {
    const test = harness(
      async () => 'new-child',
      {
        byId: { archived: { parentId: 'parent' } },
        ids: ['archived'],
      },
      ['archived'],
    )
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await expect(test.controller.open(input('parent', 10))).resolves.toBe(
      'new-child',
    )
    expect(test.forks.open).toHaveBeenCalledWith(input('parent', 10))
  })

  it('restores the most recent branch and can switch to another branch', async () => {
    const test = harness(
      async (request) => request.existingChildId ?? 'new-child',
      {
        byId: {
          older: { parentId: 'parent', updatedAt: 10 },
          recent: { parentId: 'parent', updatedAt: 20 },
        },
        ids: ['older', 'recent'],
      },
    )
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await expect(test.controller.open(input('parent', 10))).resolves.toBe(
      'recent',
    )
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: ['recent', 'older'],
      childId: 'recent',
    })

    await expect(test.controller.selectBranch('older')).resolves.toBeUndefined()
    expect(test.forks.open).toHaveBeenLastCalledWith({
      ...input('parent', 10),
      existingChildId: 'older',
    })
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: ['recent', 'older'],
      childId: 'older',
      status: 'open',
    })
  })

  it('creates an additional branch only after an explicit action', async () => {
    const test = harness(
      async (request) => request.existingChildId ?? 'new-child',
      {
        byId: { existing: { parentId: 'parent', updatedAt: 10 } },
        ids: ['existing'],
      },
    )
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })
    await test.controller.open(input('parent', 10))

    await expect(test.controller.createBranch()).resolves.toBe('new-child')

    expect(test.forks.open).toHaveBeenLastCalledWith(input('parent', 10))
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: ['new-child', 'existing'],
      childId: 'new-child',
      status: 'open',
    })
  })
})
