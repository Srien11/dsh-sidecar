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

function harness(open: (input: OpenSidecarInput) => Promise<string>) {
  const forks = { open: vi.fn(open) } as unknown as ForkController
  const gateway: SidecarSessionGateway = {
    cancel: vi.fn(),
    closeChildSurface: vi.fn().mockResolvedValue(undefined),
    fork: vi.fn(),
    openChildSurface: vi.fn(),
    prompt: vi.fn(),
  }
  const anchors: AnchorRepository = {
    get: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
  }
  const sessions = {
    list: {
      getSnapshot: () => ({ byId: {}, ids: [] }),
    },
  }

  return {
    controller: new SidecarController(
      forks,
      gateway,
      sessions as never,
      anchors,
    ),
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
