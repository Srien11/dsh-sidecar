import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type {
  ISessions,
  IWorkspaces,
  SessionFace,
} from '@deepseek-ai/dsh-client-runtime/client'
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
  const api = {
    sessions: {
      cancel: vi.fn(),
      prompt: vi.fn(),
    },
  } as unknown as IApiClient

  return {
    api,
    gateway: new HarnessSessionGateway(sessions, api),
    session,
    sessions,
  }
}

describe('HarnessSessionGateway', () => {
  it('creates an independent child in the parent workspace without opening it', async () => {
    const test = harness()
    const workspaces = {
      connectWorkspace: vi.fn().mockResolvedValue('independent-child'),
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
    const gateway = new HarnessSessionGateway(test.sessions, test.api, workspaces)

    await expect(gateway.createIndependent('parent')).resolves.toEqual({
      childId: 'independent-child',
    })
    expect(workspaces.connectWorkspace).toHaveBeenCalledWith('workspace-1')
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
    const history = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          error: { code: 'not-found', message: 'not ready' },
          ok: false,
        },
      })
      .mockResolvedValueOnce({ result: { ok: true, value: {} } })
    ;(test.api.sessions as unknown as { history: typeof history }).history = history

    const opening = test.gateway.openChildSurface('child')
    await vi.runAllTimersAsync()

    await expect(opening).resolves.toBeUndefined()
    expect(history).toHaveBeenCalledTimes(2)
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
    expect(test.api.sessions.prompt).not.toHaveBeenCalled()
  })

  it('cancels through the official SessionFace', async () => {
    const test = harness()

    await test.gateway.cancel('child')

    expect(test.sessions.binding).toHaveBeenCalledWith('child')
    expect(test.session.cancel).toHaveBeenCalledWith()
    expect(test.api.sessions.cancel).not.toHaveBeenCalled()
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
