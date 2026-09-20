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
    createIndependent: vi.fn().mockResolvedValue({ childId: 'snapshot-child' }),
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
    binding: vi.fn(),
    list: {
      getSnapshot: () => list,
    },
  }
  const workspaces = {
    archiveSession: vi.fn().mockResolvedValue(undefined),
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
    sessions,
    workspaces,
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
    const test = harness(
      (request) =>
        request.parentId === 'parent-a' ? first.promise : second.promise,
      {
        byId: {
          'child-a': { parentId: 'parent-a' },
          'child-b': { parentId: 'parent-b' },
        },
        ids: ['child-a', 'child-b'],
      },
    )
    vi.mocked(test.anchors.get).mockImplementation(async (childId) =>
      childId === 'child-a'
        ? { parentSessionId: 'parent-a', seedLength: 11, turnEndSeq: 10 }
        : { parentSessionId: 'parent-b', seedLength: 21, turnEndSeq: 20 },
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
    const test = harness(() => pending.promise, {
      byId: { child: { parentId: 'parent' } },
      ids: ['child'],
    })
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    const opening = test.controller.open(input('parent', 10))
    await vi.waitFor(() => expect(test.forks.open).toHaveBeenCalledTimes(1))
    await test.controller.close()

    pending.resolve('child')
    await opening

    expect(test.controller.getSnapshot()).toEqual({ status: 'closed' })
  })

  it('restores focus to the remembered trigger after close', async () => {
    const test = harness(async () => 'child')
    const focus = vi.fn()
    test.controller.rememberReturnFocus({
      focus,
      isConnected: true,
    } as unknown as HTMLElement)

    await test.controller.close()
    await Promise.resolve()

    expect(focus).toHaveBeenCalledTimes(1)
  })
})

describe('SidecarController branch identity', () => {
  it('opens every fresh follow-up as a separate pending drawer', async () => {
    const test = harness(async () => 'new-child', {
      byId: { existing: { parentId: 'parent', updatedAt: 10 } },
      ids: ['existing'],
    })
    vi.mocked(test.anchors.get).mockResolvedValue({
      hidden: true,
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await test.controller.open({ ...input('parent', 10), fresh: true })

    expect(test.forks.open).not.toHaveBeenCalled()
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: [],
      parentId: 'parent',
      status: 'open',
      turnEndSeq: 10,
    })
    expect(test.controller.getSnapshot().childId).toBeUndefined()
    expect(test.controller.getSnapshot().anchorKey).toMatch(
      /^parent:10:draft:\d+$/,
    )
  })

  it('restores only the explicitly chosen follow-up in the drawer', async () => {
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
      excerpt: '持久化的选中文字',
      hidden: true,
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await test.controller.open({ ...input('parent', 10), branchId: 'older' })

    expect(test.forks.open).toHaveBeenCalledWith({
      ...input('parent', 10),
      existingChildId: 'older',
    })
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: ['older'],
      childId: 'older',
      excerpt: '持久化的选中文字',
      status: 'open',
    })
  })

  it('persists the selected excerpt with the newly created follow-up', async () => {
    const test = harness(async () => 'child')
    await test.controller.open({
      ...input('parent', 10),
      excerpt: '需要解释的原文',
      fresh: true,
    })

    await test.controller.prompt('为什么？')

    expect(test.anchors.put).toHaveBeenCalledWith('child', {
      excerpt: '需要解释的原文',
      hidden: true,
      parentSessionId: 'parent',
      seedLength: 11,
      summary: '为什么？',
      turnEndSeq: 10,
    })
    expect(test.controller.getSnapshot()).toMatchObject({
      childId: 'child',
      excerpt: '需要解释的原文',
      status: 'open',
    })
  })

  it('opens a new anchor locally without creating a child session', async () => {
    const test = harness(async () => 'child')

    await expect(test.controller.open(input('parent', 10))).resolves.toBeUndefined()

    expect(test.forks.open).not.toHaveBeenCalled()
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: [],
      parentId: 'parent',
      status: 'open',
      turnEndSeq: 10,
    })
    expect(test.controller.getSnapshot().childId).toBeUndefined()
  })

  it('creates one child on the first prompt and reuses it afterwards', async () => {
    const test = harness(async () => 'child')
    const order: string[] = []
    vi.mocked(test.workspaces.archiveSession).mockImplementation(async () => {
      order.push('hidden')
    })
    vi.mocked(test.gateway.prompt).mockImplementation(async () => {
      order.push('prompted')
    })
    await test.controller.open(input('parent', 10))

    await test.controller.prompt('第一次追问')
    await test.controller.prompt('继续追问')

    expect(test.forks.open).toHaveBeenCalledTimes(1)
    expect(test.forks.open).toHaveBeenCalledWith({
      ...input('parent', 10),
      summary: '第一次追问',
    })
    expect(test.gateway.prompt).toHaveBeenNthCalledWith(1, 'child', '第一次追问')
    expect(test.gateway.prompt).toHaveBeenNthCalledWith(2, 'child', '继续追问')
    expect(test.anchors.put).toHaveBeenCalledWith('child', {
      hidden: true,
      parentSessionId: 'parent',
      seedLength: 11,
      summary: '第一次追问',
      turnEndSeq: 10,
    })
    expect(test.workspaces.archiveSession).toHaveBeenCalledWith('child')
    expect(order).toEqual(['hidden', 'prompted', 'prompted'])
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: ['child'],
      childId: 'child',
      status: 'open',
    })
  })

  it('reuses the prepared child when the first prompt must be retried', async () => {
    const test = harness(async () => 'child')
    vi.mocked(test.gateway.prompt)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined)
    await test.controller.open(input('parent', 10))

    await expect(test.controller.prompt('第一次追问')).rejects.toThrow(
      'temporary failure',
    )
    await test.controller.prompt('重试追问')

    expect(test.forks.open).toHaveBeenCalledTimes(1)
    expect(test.gateway.prompt).toHaveBeenNthCalledWith(2, 'child', '重试追问')
  })

  it('does not prompt or refork when hiding the child must be retried', async () => {
    const test = harness(async () => 'child')
    vi.mocked(test.workspaces.archiveSession)
      .mockRejectedValueOnce(new Error('archive unavailable'))
      .mockResolvedValueOnce(undefined)
    await test.controller.open(input('parent', 10))

    await expect(test.controller.prompt('第一次追问')).rejects.toThrow(
      'archive unavailable',
    )
    expect(test.gateway.prompt).not.toHaveBeenCalled()

    await test.controller.prompt('重试追问')

    expect(test.forks.open).toHaveBeenCalledTimes(1)
    expect(test.workspaces.archiveSession).toHaveBeenCalledTimes(2)
    expect(test.gateway.prompt).toHaveBeenCalledWith('child', '重试追问')
  })

  it('does not count an unrecorded ordinary Harness fork as a sidecar', async () => {
    const test = harness(async () => 'child', {
      byId: { ordinary: { parentId: 'parent' } },
      ids: ['ordinary'],
    })
    vi.mocked(test.anchors.get).mockResolvedValue(undefined)

    await expect(test.controller.branchCount('parent', 10)).resolves.toBe(0)
    expect(test.anchors.get).toHaveBeenCalledWith('ordinary')
  })

  it('migrates a visible legacy sidecar out of the ordinary session list', async () => {
    const test = harness(async () => 'legacy', {
      byId: { legacy: { parentId: 'parent', updatedAt: 10 } },
      ids: ['legacy'],
    })
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await expect(test.controller.branchCount('parent', 10)).resolves.toBe(1)

    expect(test.anchors.put).toHaveBeenCalledWith('legacy', {
      hidden: true,
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })
    expect(test.workspaces.archiveSession).toHaveBeenCalledWith('legacy')
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
    expect(test.anchors.get).toHaveBeenCalledWith('archived')
  })

  it('restores a sidecar branch hidden from the ordinary session list', async () => {
    const test = harness(
      async (request) => request.existingChildId ?? 'new-child',
      {
        byId: { hidden: { parentId: 'parent', updatedAt: 10 } },
        ids: ['hidden'],
      },
      ['hidden'],
    )
    vi.mocked(test.anchors.get).mockResolvedValue({
      hidden: true,
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })

    await expect(test.controller.open(input('parent', 10))).resolves.toBe(
      'hidden',
    )
    expect(test.forks.open).toHaveBeenCalledWith({
      ...input('parent', 10),
      existingChildId: 'hidden',
    })
  })

  it('creates a new branch on first prompt instead of restoring an archived sidecar', async () => {
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

    await expect(test.controller.open(input('parent', 10))).resolves.toBeUndefined()
    expect(test.forks.open).not.toHaveBeenCalled()

    await test.controller.prompt('新的追问')

    expect(test.forks.open).toHaveBeenCalledWith({
      ...input('parent', 10),
      summary: '新的追问',
    })
    expect(test.gateway.prompt).toHaveBeenCalledWith('new-child', '新的追问')
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

  it('archives the active branch and opens the next available branch', async () => {
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
    await test.controller.open(input('parent', 10))

    await test.controller.archiveCurrentBranch()

    expect(test.workspaces.archiveSession).toHaveBeenCalledWith('recent')
    expect(test.anchors.remove).toHaveBeenCalledWith('recent')
    expect(test.forks.open).toHaveBeenLastCalledWith({
      ...input('parent', 10),
      existingChildId: 'older',
    })
    expect(test.controller.getSnapshot()).toMatchObject({
      branchIds: ['older'],
      childId: 'older',
      status: 'open',
    })
  })

  it('closes after archiving the last branch', async () => {
    const test = harness(async (request) => request.existingChildId ?? 'child', {
      byId: { child: { parentId: 'parent', updatedAt: 10 } },
      ids: ['child'],
    })
    vi.mocked(test.anchors.get).mockResolvedValue({
      parentSessionId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })
    await test.controller.open(input('parent', 10))

    await test.controller.archiveCurrentBranch()

    expect(test.workspaces.archiveSession).toHaveBeenCalledWith('child')
    expect(test.controller.getSnapshot()).toEqual({ status: 'closed' })
  })

  it('creates and seeds an independent child from the frozen running history', async () => {
    const test = harness(async () => 'native-fork')
    const frozenHistory = [
      '<dsh-sidecar-frozen-history>',
      '用户：原问题',
      '助手（输出中）：当前只输出到这里',
      '</dsh-sidecar-frozen-history>',
    ].join('\n')

    await test.controller.open({
      fresh: true,
      frozenHistory,
      mode: 'snapshot',
      parentId: 'parent',
      seedLength: 0,
      sourceTurn: 3,
      turnEndSeq: 7,
    })
    await test.controller.prompt('为什么？')
    await test.controller.prompt('再展开一点')

    expect(test.gateway.createIndependent).toHaveBeenCalledWith('parent')
    expect(test.forks.open).not.toHaveBeenCalled()
    expect(test.anchors.put).toHaveBeenCalledWith('snapshot-child', {
      hidden: true,
      mode: 'snapshot',
      parentSessionId: 'parent',
      seedLength: 0,
      sourceTurn: 3,
      summary: '为什么？',
      turnEndSeq: 7,
    })
    expect(test.workspaces.archiveSession).toHaveBeenCalledWith('snapshot-child')
    expect(test.gateway.prompt).toHaveBeenNthCalledWith(
      1,
      'snapshot-child',
      `${frozenHistory}\n\n用户追问：\n为什么？`,
    )
    expect(test.gateway.prompt).toHaveBeenNthCalledWith(
      2,
      'snapshot-child',
      '再展开一点',
    )
    expect(test.controller.getSnapshot()).toMatchObject({
      childAfterSeq: 0,
      childId: 'snapshot-child',
      mode: 'snapshot',
      snapshotSeedPending: false,
      status: 'open',
    })
  })

  it('restores a snapshot child under the answer after that turn settles', async () => {
    const test = harness(
      async (request) => request.existingChildId ?? 'native-fork',
      {
        byId: { 'snapshot-child': { updatedAt: 30 } },
        ids: ['snapshot-child'],
      },
      ['snapshot-child'],
    )
    const snapshotAnchor = {
      hidden: true as const,
      mode: 'snapshot' as const,
      parentSessionId: 'parent',
      seedLength: 0,
      sourceTurn: 3,
      turnEndSeq: 7,
    }
    test.anchors.list = vi.fn().mockResolvedValue([
      { anchor: snapshotAnchor, childSessionId: 'snapshot-child' },
    ])
    vi.mocked(test.anchors.get).mockResolvedValue(snapshotAnchor)
    test.sessions.binding.mockReturnValue({
      session: { getSnapshot: () => ({ turnEnds: new Map([[3, 10]]) }) },
    })

    await expect(test.controller.open(input('parent', 10))).resolves.toBe(
      'snapshot-child',
    )

    expect(test.forks.open).toHaveBeenCalledWith({
      ...input('parent', 10),
      existingChildId: 'snapshot-child',
    })
    expect(test.controller.getSnapshot()).toMatchObject({
      childAfterSeq: 0,
      childId: 'snapshot-child',
      mode: 'snapshot',
      sourceTurn: 3,
    })
  })
})
