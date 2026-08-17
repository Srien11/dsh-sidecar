import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidecarAction } from '../src/client/components/SidecarAction.js'
import type { SidecarActionProps } from '../src/client/components/SidecarAction.js'
import type {
  SidecarControllerState,
  SidecarUiController,
} from '../src/client/controllers/sidecar-controller.js'

afterEach(cleanup)

function props(
  snapshot: unknown,
  controller: SidecarUiController,
  messageId = 'answer-1',
): SidecarActionProps {
  return {
    controller,
    messageId,
    sessionId: 'parent',
    useSession: (selector: (value: unknown) => unknown) => selector(snapshot),
    useSessions: (selector: (value: unknown) => unknown) =>
      selector({ ids: ['parent'], byId: {}, current: 'parent' }),
  } as unknown as SidecarActionProps
}

function controller(state: Partial<SidecarControllerState> = {}): SidecarUiController {
  const snapshot: SidecarControllerState = { status: 'closed', ...state }
  return {
    branchCount: vi.fn().mockResolvedValue(0),
    close: vi.fn(),
    getSnapshot: () => snapshot,
    open: vi.fn().mockResolvedValue('child'),
    subscribe: () => () => undefined,
  }
}

const completedSnapshot = {
  nodes: [
    { kind: 'assistant', messageId: 'answer-1', seq: 8, turn: 2 },
    { kind: 'steering', messageId: 'steer-1', seq: 9 },
  ],
  turnEnds: new Map([[2, 10]]),
}

describe('SidecarAction', () => {
  it('does not render for an open turn or a non-assistant message', () => {
    const openTurn = { ...completedSnapshot, turnEnds: new Map() }
    const ui = controller()
    const { rerender } = render(<SidecarAction {...props(openTurn, ui)} />)

    expect(screen.queryByRole('button')).toBeNull()
    rerender(<SidecarAction {...props(completedSnapshot, ui, 'steer-1')} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens the exact completed answer boundary once', () => {
    const ui = controller()
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    fireEvent.click(screen.getByRole('button', { name: '追问' }))

    expect(ui.open).toHaveBeenCalledTimes(1)
    expect(ui.open).toHaveBeenCalledWith({
      parentId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })
  })

  it('shows the number of persistent children', async () => {
    const ui = controller()
    vi.mocked(ui.branchCount).mockResolvedValue(2)
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    await waitFor(() => expect(screen.getByRole('button').textContent).toContain('2'))
  })

  it('exposes localized disabled state while the same anchor is opening', () => {
    const ui = controller({
      anchorKey: 'parent:10',
      status: 'opening',
    })
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    const button = screen.getByRole('button', { name: '正在打开追问' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('title')).toBe('正在创建或恢复分支…')
  })
})
