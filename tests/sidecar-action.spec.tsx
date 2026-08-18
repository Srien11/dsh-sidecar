import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidecarAction } from '../src/client/components/SidecarAction.js'
import type { SidecarActionProps } from '../src/client/components/SidecarAction.js'
import { SIDECAR_LOCALES } from '../src/client/locales.js'
import type {
  SidecarControllerState,
  SidecarUiController,
} from '../src/client/controllers/sidecar-controller.js'

afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
})

function props(
  snapshot: unknown,
  controller: SidecarUiController,
  messageId = 'answer-1',
  archivedSessionIds: string[] = [],
  locale: 'en' | 'zh' = 'zh',
): SidecarActionProps {
  const dictionary = SIDECAR_LOCALES[locale] as Record<string, string>
  return {
    controller,
    messageId,
    sessionId: 'parent',
    t: (key: string) => dictionary[key] ?? key,
    useSession: (selector: (value: unknown) => unknown) => selector(snapshot),
    useSessions: (selector: (value: unknown) => unknown) =>
      selector({ ids: ['parent'], byId: {}, current: 'parent' }),
    useWorkspaces: (selector: (value: unknown) => unknown) =>
      selector({ archivedSessionIds }),
  } as unknown as SidecarActionProps
}

function controller(state: Partial<SidecarControllerState> = {}): SidecarUiController {
  const snapshot: SidecarControllerState = { status: 'closed', ...state }
  return {
    archiveCurrentBranch: vi.fn(),
    branchCount: vi.fn().mockResolvedValue(0),
    close: vi.fn(),
    createBranch: vi.fn().mockResolvedValue('child'),
    getSnapshot: () => snapshot,
    rememberReturnFocus: vi.fn(),
    open: vi.fn().mockResolvedValue('child'),
    prompt: vi.fn().mockResolvedValue(undefined),
    selectBranch: vi.fn().mockResolvedValue(undefined),
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

    const button = screen.getByRole('button', { name: '追问' })
    fireEvent.click(button)

    expect(ui.rememberReturnFocus).toHaveBeenCalledWith(button)
    expect(ui.open).toHaveBeenCalledTimes(1)
    expect(ui.open).toHaveBeenCalledWith({
      parentId: 'parent',
      seedLength: 11,
      turnEndSeq: 10,
    })
  })

  it('keeps this answer selection after the action takes focus', () => {
    const ui = controller()
    const { container } = render(
      <section data-chat-flow>
        <div data-chat-flow-kind="assistant-step">
          <p>
            前文<span id="selected-excerpt">精确选中的片段</span>后文
          </p>
        </div>
        <div data-chat-flow-kind="turn-tail">
          <div data-turn-tail="2">
            <SidecarAction {...props(completedSnapshot, ui)} />
          </div>
        </div>
      </section>,
    )
    const selected = container.querySelector('#selected-excerpt')
    expect(selected).not.toBeNull()

    const range = document.createRange()
    range.selectNodeContents(selected as Element)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    const button = screen.getByRole('button', { name: '追问' })
    fireEvent.pointerDown(button)
    window.getSelection()?.removeAllRanges()
    fireEvent.click(button)

    expect(ui.open).toHaveBeenCalledWith({
      excerpt: '精确选中的片段',
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

  it('refreshes the branch count when archived sessions change', async () => {
    const ui = controller()
    vi.mocked(ui.branchCount)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
    const { rerender } = render(
      <SidecarAction {...props(completedSnapshot, ui)} />,
    )

    await waitFor(() => expect(screen.getByRole('button').textContent).toContain('2'))
    rerender(
      <SidecarAction
        {...props(completedSnapshot, ui, 'answer-1', ['archived-child'])}
      />,
    )

    await waitFor(() => expect(screen.getByRole('button').textContent).toContain('1'))
    expect(ui.branchCount).toHaveBeenCalledTimes(2)
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

  it('renders the English action from the active locale', () => {
    const ui = controller()
    render(
      <SidecarAction
        {...props(completedSnapshot, ui, 'answer-1', [], 'en')}
      />,
    )

    expect(screen.getByRole('button', { name: 'Ask follow-up' })).toBeTruthy()
  })
})
