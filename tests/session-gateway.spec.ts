import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type {
  ISessions,
  SessionFace,
} from '@deepseek-ai/dsh-client-runtime/client'
import { describe, expect, it, vi } from 'vitest'

import { HarnessSessionGateway } from '../src/client/controllers/session-gateway.js'

function harness(result: { ok: boolean; error?: { code: string; message: string } } = { ok: true }) {
  const session = {
    cancel: vi.fn().mockResolvedValue(result),
    prompt: vi.fn().mockResolvedValue(result),
  } as unknown as SessionFace
  const sessions = {
    binding: vi.fn().mockReturnValue({ session }),
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
  })
})
