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
    t: (key: string, params?: Record<string, unknown>) =>
      (dictionary[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name: string) => String(params?.[name] ?? `{${name}}`),
      ),
    useChat: (selector: (value: unknown) => unknown) => selector(snapshot),
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
    branches: vi.fn().mockResolvedValue([]),
    prompt: vi.fn().mockResolvedValue(undefined),
    selectBranch: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => undefined,
  }
}

const completedSnapshot = {
  legacy: { nodes: [], partial: null, turnEnds: new Map([[2, 10]]) },
  nodes: {
    get: (key: string) =>
      key === 'answer'
        ? {
            data: {
              finalNode: { messageId: 'answer-1' },
              turn: 2,
            },
            kind: 'assistant-step',
          }
        : undefined,
  },
  order: ['answer'],
}

/** Answer row immediately owned by a turn-tail action, without stray text nodes. */
function answerWithTail(answer: string, ui: SidecarUiController) {
  return (
    <section data-chat-flow>
      <div
        data-chat-flow-kind="assistant-step"
        dangerouslySetInnerHTML={{ __html: answer }}
      />
      <div data-chat-flow-kind="turn-tail">
        <SidecarAction {...props(completedSnapshot, ui)} />
      </div>
    </section>
  )
}

describe('SidecarAction', () => {
  it('does not render for an open turn or a non-assistant message', () => {
    const openTurn = {
      ...completedSnapshot,
      legacy: { ...completedSnapshot.legacy, turnEnds: new Map() },
    }
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
      fresh: true,
      parentId: 'parent',
      seedLength: 11,
      sourceTurn: 2,
      turnEndSeq: 10,
    })
  })

  it('keeps this answer selection after the action takes focus', () => {
    const ui = controller()
    const { container } = render(
      answerWithTail(
        '<p>前文<span id="selected-excerpt">精确选中的片段</span>后文</p>',
        ui,
      ),
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
      excerptOffset: 2,
      fresh: true,
      parentId: 'parent',
      seedLength: 11,
      sourceTurn: 2,
      turnEndSeq: 10,
    })
  })

  it('opens an immediate follow-up from the selection beside this answer', async () => {
    const ui = controller()
    const { container } = render(
      answerWithTail(
        '<p>前文<span id="inline-selection">结论：\nconst value = 1;</span>后文</p>',
        ui,
      ),
    )
    const selected = container.querySelector('#inline-selection') as Element
    const range = document.createRange()
    range.selectNodeContents(selected)
    Object.defineProperty(range, 'getBoundingClientRect', {
      value: () => new DOMRect(120, 80, 64, 20),
    })
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent(document, new Event('selectionchange'))

    const floating = await screen.findByRole('button', {
      name: '追问选中内容',
    })
    expect(floating.style.position).toBe('fixed')
    expect(floating.style.left).not.toBe('')
    expect(floating.style.top).not.toBe('')

    fireEvent.pointerDown(floating)
    window.getSelection()?.removeAllRanges()
    fireEvent.click(floating)

    expect(ui.open).toHaveBeenCalledWith({
      excerpt: '结论：\nconst value = 1;',
      excerptOffset: 2,
      fresh: true,
      parentId: 'parent',
      seedLength: 11,
      sourceTurn: 2,
      turnEndSeq: 10,
    })
  })

  it('does not show the immediate action for a page selection', async () => {
    const ui = controller()
    const { container } = render(
      <main>
        <p id="page-selection">页面上的其他文字</p>
        <section data-chat-flow>
          <div data-chat-flow-kind="assistant-step">当前回答</div>
          <div data-chat-flow-kind="turn-tail">
            <SidecarAction {...props(completedSnapshot, ui)} />
          </div>
        </section>
      </main>,
    )
    const range = document.createRange()
    range.selectNodeContents(container.querySelector('#page-selection') as Element)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent(document, new Event('selectionchange'))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '追问选中内容' }),
      ).toBeNull(),
    )
  })

  it('lists existing follow-ups by summary instead of position', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      { childId: 'child-a', summary: '为什么先合并提交', updatedAt: 20 },
      { childId: 'child-b', title: '缓存失效边界', updatedAt: 10 },
    ])
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    const existing = await screen.findByRole('combobox', { name: '已有追问' })
    expect((existing as HTMLSelectElement).value).toBe('')
    expect(
      screen.getByRole('option', {
        name: '已有追问（2）· 最新：为什么先合并提交',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('option', { name: '为什么先合并提交' }),
    ).toBeTruthy()
    expect(screen.getByRole('option', { name: '缓存失效边界' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: '追问 1' })).toBeNull()
  })

  it('falls back to a positional label when a follow-up has no text yet', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      { childId: 'child-a', updatedAt: 20 },
    ])
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    expect(
      await screen.findByRole('option', { name: '追问 1' }),
    ).toBeTruthy()
  })

  it('restores one existing follow-up without sharing it inside the drawer', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      { childId: 'child-a', summary: '第一个问题', updatedAt: 20 },
      { childId: 'child-b', summary: '第二个问题', updatedAt: 10 },
    ])
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    const existing = await screen.findByRole('combobox', { name: '已有追问' })
    fireEvent.change(existing, { target: { value: 'child-b' } })

    expect(ui.open).toHaveBeenCalledWith({
      branchId: 'child-b',
      parentId: 'parent',
      seedLength: 11,
      sourceTurn: 2,
      turnEndSeq: 10,
    })
  })

  it('keeps the current follow-up selected and visibly marked', async () => {
    const ui = controller({
      childId: 'child-b',
      parentId: 'parent',
      seedLength: 11,
      status: 'open',
      turnEndSeq: 10,
    })
    vi.mocked(ui.branches).mockResolvedValue([
      { childId: 'child-a', summary: '第一个问题', updatedAt: 20 },
      { childId: 'child-b', summary: '第二个问题', updatedAt: 10 },
    ])
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    const existing = await screen.findByRole('combobox', { name: '已有追问' })
    await waitFor(() => expect((existing as HTMLSelectElement).value).toBe('child-b'))
    expect(existing.classList.contains('dsh-sidecar-branch-restore-active')).toBe(
      true,
    )
    expect(
      screen
        .getByRole('option', { name: '第二个问题' })
        .getAttribute('aria-current'),
    ).toBe('true')
  })

  it('refreshes the branch list when archived sessions change', async () => {
    const ui = controller()
    vi.mocked(ui.branches)
      .mockResolvedValueOnce([
        { childId: 'child-a', summary: '第一个问题', updatedAt: 20 },
        { childId: 'child-b', summary: '第二个问题', updatedAt: 10 },
      ])
      .mockResolvedValueOnce([
        { childId: 'child-a', summary: '第一个问题', updatedAt: 20 },
      ])
    const { rerender } = render(
      <SidecarAction {...props(completedSnapshot, ui)} />,
    )

    await waitFor(() =>
      expect(screen.getByRole('option', { name: '第二个问题' })).toBeTruthy(),
    )
    rerender(
      <SidecarAction
        {...props(completedSnapshot, ui, 'answer-1', ['archived-child'])}
      />,
    )

    await waitFor(() =>
      expect(screen.queryByRole('option', { name: '第二个问题' })).toBeNull(),
    )
    expect(ui.branches).toHaveBeenCalledTimes(2)
  })

  it('exposes localized disabled state while the same anchor is opening', () => {
    const ui = controller({
      anchorKey: 'parent:10',
      status: 'opening',
    })
    render(<SidecarAction {...props(completedSnapshot, ui)} />)

    const button = screen.getByRole('button', { name: '正在打开追问' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('title')).toBe('正在创建或恢复追问…')
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

describe('SidecarAction in-answer highlights', () => {
  it('marks the excerpt of a selection follow-up and opens it on activation', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      {
        childId: 'child-a',
        excerpt: '精确选中的片段',
        excerptOffset: 2,
        summary: '这里为什么这么写',
        updatedAt: 20,
      },
    ])
    render(answerWithTail('<p>前文精确选中的片段后文</p>', ui))

    const mark = await screen.findByRole('button', {
      name: '打开追问：这里为什么这么写',
    })
    expect(mark.textContent).toBe('精确选中的片段')
    expect(mark.getAttribute('data-dsh-sidecar-branch')).toBe('child-a')
    expect(mark.className).toBe('dsh-sidecar-highlight')

    fireEvent.click(mark)

    expect(ui.rememberReturnFocus).toHaveBeenCalledWith(mark)
    expect(ui.open).toHaveBeenCalledWith({
      branchId: 'child-a',
      parentId: 'parent',
      seedLength: 11,
      sourceTurn: 2,
      turnEndSeq: 10,
    })
  })

  it('highlights the recorded occurrence when the excerpt repeats', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      {
        childId: 'child-a',
        excerpt: '重复片段',
        excerptOffset: 10,
        summary: '第二个重复片段',
        updatedAt: 20,
      },
    ])
    const { container } = render(
      answerWithTail('<p>重复片段，中间文字，重复片段</p>', ui),
    )

    const mark = await screen.findByRole('button', {
      name: '打开追问：第二个重复片段',
    })
    expect(mark.textContent).toBe('重复片段')
    expect(container.querySelectorAll('mark.dsh-sidecar-highlight').length).toBe(1)
    expect(mark.previousSibling?.textContent).toBe('重复片段，中间文字，')
    expect(container.querySelector('p')?.textContent).toBe(
      '重复片段，中间文字，重复片段',
    )
  })

  it('leaves the answer untouched when a branch has no excerpt', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      { childId: 'child-a', summary: '只在段尾的追问', updatedAt: 20 },
    ])
    const { container } = render(answerWithTail('<p>当前回答内容</p>', ui))

    await screen.findByRole('combobox', { name: '已有追问' })
    expect(container.querySelectorAll('mark.dsh-sidecar-highlight').length).toBe(0)
    expect(container.querySelector('p')?.textContent).toBe('当前回答内容')
  })

  it('does not mark an excerpt that spans two blocks', async () => {
    const ui = controller()
    vi.mocked(ui.branches).mockResolvedValue([
      {
        childId: 'child-a',
        excerpt: '第一段第二段',
        summary: '跨段落追问',
        updatedAt: 20,
      },
    ])
    const { container } = render(
      answerWithTail('<p>第一段</p><p>第二段</p>', ui),
    )

    await screen.findByRole('combobox', { name: '已有追问' })
    await waitFor(() =>
      expect(container.querySelectorAll('mark.dsh-sidecar-highlight').length).toBe(0),
    )
    expect(
      container.querySelector('[data-chat-flow-kind="assistant-step"]')?.textContent,
    ).toBe('第一段第二段')
  })
})
