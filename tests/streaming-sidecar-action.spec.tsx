import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  StreamingSidecarAction,
  type StreamingSidecarActionProps,
} from '../src/client/components/StreamingSidecarAction.js'
import type { SidecarUiController } from '../src/client/controllers/sidecar-controller.js'
import { SIDECAR_LOCALES } from '../src/client/locales.js'

afterEach(cleanup)

function controller(): SidecarUiController {
  const snapshot = { status: 'closed' as const }
  return {
    archiveCurrentBranch: vi.fn(),
    branchCount: vi.fn(),
    branches: vi.fn(),
    close: vi.fn(),
    createBranch: vi.fn(),
    getSnapshot: () => snapshot,
    open: vi.fn().mockResolvedValue(undefined),
    prompt: vi.fn(),
    rememberReturnFocus: vi.fn(),
    selectBranch: vi.fn(),
    subscribe: () => () => undefined,
  }
}

function props(ui: SidecarUiController): StreamingSidecarActionProps {
  const nodes = new Map([
    [
      'user',
      {
        anchorSeq: 1,
        data: { content: [{ text: '问题', type: 'text' }] },
        kind: 'user',
        visibility: 'visible',
      },
    ],
    [
      'assistant',
      {
        anchorSeq: 7,
        data: {
          blocks: [{ kind: 'text', text: '回答到这里' }],
          status: 'running',
          turn: 3,
        },
        kind: 'assistant-step',
        visibility: 'visible',
      },
    ],
  ])
  const dictionary = SIDECAR_LOCALES.zh as Record<string, string>
  return {
    controller: ui,
    input: {},
    session: {
      chat: {
        nodes: { get: (key: string) => nodes.get(key) },
        order: ['user', 'assistant'],
      },
      nodes: [],
      partial: null,
      running: true,
      turnEnds: new Map(),
    },
    sessionId: 'parent',
    t: (key: string) => dictionary[key] ?? key,
  } as unknown as StreamingSidecarActionProps
}

describe('StreamingSidecarAction', () => {
  it('opens a fresh independent snapshot while the answer is still running', () => {
    const ui = controller()
    render(<StreamingSidecarAction {...props(ui)} />)

    const button = screen.getByRole('button', { name: '追问当前输出' })
    fireEvent.click(button)

    expect(ui.rememberReturnFocus).toHaveBeenCalledWith(button)
    expect(ui.open).toHaveBeenCalledWith({
      fresh: true,
      frozenHistory: expect.stringContaining('助手（输出中）：回答到这里'),
      mode: 'snapshot',
      parentId: 'parent',
      seedLength: 0,
      sourceTurn: 3,
      turnEndSeq: 7,
    })
  })
})
