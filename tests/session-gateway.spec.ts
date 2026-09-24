import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  ISessions,
  SessionFace,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { describe, expect, it, vi } from 'vitest'

import { HarnessSessionGateway } from '../src/client/controllers/session-gateway.js'

function harness(result: { ok: boolean; error?: { code: string; message: string } } = { ok: true }) {
  const session = {
    cancel: vi.fn().mockResolvedValue(result),
    prompt: vi.fn().mockResolvedValue(result),
    rename: vi.fn().mockResolvedValue(result),
  } as unknown as SessionFace
  const sessions = {
    binding: vi.fn().mockReturnValue({ session }),
    fork: vi.fn().mockResolvedValue('child'),
    open: vi.fn(),
  } as unknown as ISessions
  const follow = vi.fn(() =>
    (async function* () {
      yield {
        cursor: 0,
        hasMore: false,
        header: {},
        projections: { asOfSeq: -1, values: {} },
        records: [],
        type: 'snapshot' as const,
      }
    })(),
  )
  const remote = {
    session: {
      follow,
    },
  } as unknown as ClientRemote
  const uiWorkspace = {
    connectWorkspace: vi.fn().mockResolvedValue('independent-child'),
  } as unknown as UiWorkspace

  return {
    follow,
    gateway: new HarnessSessionGateway(sessions, remote, uiWorkspace),
    remote,
    session,
    sessions,
    uiWorkspace,
  }
}

describe('HarnessSessionGateway', () => {
  it('creates an independent child in the parent workspace without opening it', async () => {
    const test = harness()
    const workspaces = {
      list: {
        getSnapshot: () => ({
          items: [
            {
              sessionIds: ['parent'],
              workspaceId: 'workspace-1',
            },
          ],
        }),
      },
    } as unknown as IWorkspaces
    const gateway = new HarnessSessionGateway(
      test.sessions,
      test.remote,
      test.uiWorkspace,
      workspaces,
    )

    await expect(gateway.createIndependent('parent')).resolves.toEqual({
      childId: 'independent-child',
    })
    expect(test.uiWorkspace.connectWorkspace).toHaveBeenCalledWith('workspace-1')
    expect(test.sessions.open).not.toHaveBeenCalled()
  })

  it('reuses a fork id published by a workspace attachment failure', async () => {
    const test = harness()
    vi.mocked(test.sessions.fork).mockRejectedValue(
      Object.assign(new Error('workspace attachment failed'), {
        rpcError: {
          code: 'workspace-attach-failed',
          details: { sessionId: 'published-child' },
          message: 'workspace attachment failed',
        },
      }),
    )

    await expect(
      test.gateway.fork({ atSeq: 42, sessionId: 'parent' }),
    ).resolves.toEqual({ childId: 'published-child' })
  })

  it('waits for a newly created child to become history-readable', async () => {
    vi.useFakeTimers()
    const test = harness()
    const follow = vi
      .fn()
      .mockImplementationOnce(() =>
        (async function* () {
          throw { code: 'not-found', details: {}, message: 'not ready' }
        })(),
      )
      .mockImplementationOnce(() =>
        (async function* () {
          yield { type: 'snapshot' as const }
        })(),
      )
    ;(test.remote.session as unknown as { follow: typeof follow }).follow = follow

    const opening = test.gateway.openChildSurface('child')
    await vi.runAllTimersAsync()

    await expect(opening).resolves.toBeUndefined()
    expect(follow).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('prompts through the official SessionFace', async () => {
    const test = harness()

    await test.gateway.prompt('child', 'follow up')

    expect(test.sessions.binding).toHaveBeenCalledWith('child')
    expect(test.session.prompt).toHaveBeenCalledWith(
      [{ text: 'follow up', type: 'text' }],
      'queue',
    )
  })

  it('cancels through the official SessionFace', async () => {
    const test = harness()

    await test.gateway.cancel('child')

    expect(test.sessions.binding).toHaveBeenCalledWith('child')
    expect(test.session.cancel).toHaveBeenCalledWith()
  })

  it('renames through the official SessionFace', async () => {
    const test = harness()

    await test.gateway.rename('child', 'Focused branch')

    expect(test.sessions.binding).toHaveBeenCalledWith('child')
    expect(test.session.rename).toHaveBeenCalledWith('Focused branch')
  })

  it('reports SessionFace business failures', async () => {
    const test = harness({
      error: { code: 'busy', message: 'still running' },
      ok: false,
    })

    await expect(test.gateway.prompt('child', 'follow up')).rejects.toThrow(
      'Sending sidecar prompt failed: busy: still running',
    )
    await expect(test.gateway.cancel('child')).rejects.toThrow(
      'Cancelling sidecar turn failed: busy: still running',
    )
    await expect(test.gateway.rename('child', 'Title')).rejects.toThrow(
      'Renaming sidecar failed: busy: still running',
    )
  })
})
