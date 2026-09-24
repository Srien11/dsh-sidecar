import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidecarDrawer } from '../src/client/components/SidecarDrawer.js'
import type { SidecarDrawerProps } from '../src/client/components/SidecarDrawer.js'
import type { SidecarUiController } from '../src/client/controllers/sidecar-controller.js'
import { SIDECAR_LOCALES } from '../src/client/locales.js'
import {
  SIDECAR_WINDOW_STORAGE_KEY,
  defaultWindowRect,
} from '../src/client/window-geometry.js'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** Pointer input built from MouseEvent so clientX/clientY survive in jsdom. */
function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
}

function frameOf(container: HTMLElement): {
  height: string
  left: string
  top: string
  width: string
} {
  const aside = container.querySelector('aside') as HTMLElement
  return {
    height: aside.style.getPropertyValue('--dsh-sidecar-window-height'),
    left: aside.style.getPropertyValue('--dsh-sidecar-window-left'),
    top: aside.style.getPropertyValue('--dsh-sidecar-window-top'),
    width: aside.style.getPropertyValue('--dsh-sidecar-window-width'),
  }
}

function props(
  pendingInteraction: 'approval' | 'plan-review' | 'question',
  openSession: (sessionId: string) => void,
  overrides: {
    branchIds?: string[]
    childId?: string
    controller?: Partial<SidecarUiController>
    deferred?: boolean
  } = {},
): SidecarDrawerProps {
  const state = overrides.deferred
    ? {
        branchIds: [],
        parentId: 'parent',
        seedLength: 11,
        status: 'open' as const,
        turnEndSeq: 10,
      }
    : {
        branchIds: overrides.branchIds ?? ['child'],
        childId: overrides.childId ?? 'child',
        parentId: 'parent',
        seedLength: 11,
        status: 'open' as const,
        turnEndSeq: 10,
      }
  const controller: SidecarUiController = {
    archiveCurrentBranch: vi.fn().mockResolvedValue(undefined),
    branchCount: vi.fn(),
    branches: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
    createBranch: vi.fn().mockResolvedValue('child'),
    getSnapshot: () => state,
    rememberReturnFocus: vi.fn(),
    open: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
    selectBranch: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => undefined,
    ...overrides.controller,
  }
  const dictionary = SIDECAR_LOCALES.zh as Record<string, string>

  return {
    controller,
    gateway: {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn(),
      openChildSurface: vi.fn(),
      prompt: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
    },
    history: { history: vi.fn().mockResolvedValue([]) },
    openSession,
    t: (key: string, params?: Record<string, unknown>) =>
      (dictionary[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name: string) => String(params?.[name] ?? `{${name}}`),
      ),
    useSessionPendingInteraction: (
      selector: (snapshot: Map<string, { kind: string }>) => unknown,
    ) => selector(new Map([['child', { kind: pendingInteraction }]])),
    useSessions: (selector: (snapshot: unknown) => unknown) =>
      selector({
        byId: {
          child: {
            displayTitle: '当前分支',
            pendingInteraction,
            running: true,
          },
          older: { displayTitle: '旧分支', running: false },
        },
      }),
  } as unknown as SidecarDrawerProps
}

describe('SidecarDrawer pending interaction', () => {
  it.each([
    ['approval', '侧边会话正在等待工具审批。'],
    ['question', '侧边会话正在等待你的回答。'],
    ['plan-review', '侧边会话正在等待计划确认。'],
  ] as const)('shows the %s blocking reason', (kind, message) => {
    render(<SidecarDrawer {...props(kind, vi.fn())} />)

    expect(screen.getByText(message)).toBeTruthy()
  })

  it('opens the child only after an explicit user action', () => {
    const openSession = vi.fn()
    render(<SidecarDrawer {...props('approval', openSession)} />)

    expect(openSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '打开子会话处理' }))

    expect(openSession).toHaveBeenCalledWith('child')
  })
})

describe('SidecarDrawer branch controls', () => {
  it('does not put other follow-ups or a new-follow-up action inside this drawer', () => {
    render(<SidecarDrawer {...props('approval', vi.fn(), { branchIds: ['child', 'older'] })} />)

    expect(screen.queryByRole('combobox', { name: '侧边追问分支' })).toBeNull()
    expect(screen.queryByRole('button', { name: '新建分支' })).toBeNull()
    expect(screen.getByRole('button', { name: '重命名当前追问' })).toBeTruthy()
  })

  it('renames the current branch with an explicit title', async () => {
    const drawerProps = props('approval', vi.fn())
    const rename = vi.mocked(drawerProps.gateway.rename)
    render(<SidecarDrawer {...drawerProps} />)

    fireEvent.click(
      screen.getByRole('button', { name: '重命名当前追问' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: '追问名称' }), {
      target: { value: '精确解释' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))

    expect(rename).toHaveBeenCalledWith('child', '精确解释')
  })

  it('archives only after an explicit confirmation', () => {
    const archiveCurrentBranch = vi.fn().mockResolvedValue(undefined)
    render(
      <SidecarDrawer
        {...props('approval', vi.fn(), {
          controller: { archiveCurrentBranch },
        })}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: '归档当前追问' }),
    )
    expect(archiveCurrentBranch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认归档' }))
    expect(archiveCurrentBranch).toHaveBeenCalledTimes(1)
  })
})

describe('SidecarDrawer focus', () => {
  it('keeps the composer available before a child session exists', async () => {
    const drawerProps = props('approval', vi.fn(), { deferred: true })
    render(<SidecarDrawer {...drawerProps} />)

    const composer = screen.getByRole('textbox', { name: '侧边追问' })
    fireEvent.change(composer, { target: { value: '第一次追问' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() =>
      expect(drawerProps.controller.prompt).toHaveBeenCalledWith('第一次追问'),
    )
    expect(drawerProps.gateway.fork).not.toHaveBeenCalled()
  })

  it('focuses the composer when the drawer opens', () => {
    render(<SidecarDrawer {...props('approval', vi.fn())} />)

    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: '侧边追问' }),
    )
  })
})

describe('SidecarDrawer floating window', () => {
  const expected = defaultWindowRect({
    height: window.innerHeight,
    width: window.innerWidth,
  })

  it('starts as an inset floating frame instead of a full-height dock', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)

    expect(frameOf(container)).toEqual({
      height: `${expected.height}px`,
      left: `${expected.left}px`,
      top: `${expected.top}px`,
      width: `${expected.width}px`,
    })
  })

  it('moves the frame while the header handle is dragged', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const handle = screen.getByRole('button', { name: '拖动窗口' })

    fireEvent(handle, pointer('pointerdown', 400, 300))
    fireEvent(handle, pointer('pointermove', 340, 295))
    fireEvent(handle, pointer('pointermove', 300, 290))
    fireEvent(handle, pointer('pointerup', 300, 290))

    expect(frameOf(container)).toMatchObject({
      left: `${expected.left - 100}px`,
      top: `${expected.top - 10}px`,
    })
    expect(JSON.parse(localStorage.getItem(SIDECAR_WINDOW_STORAGE_KEY) ?? '{}')).toMatchObject({
      left: expected.left - 100,
      top: expected.top - 10,
    })
  })

  it('drags the window from anywhere on the title bar', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const bar = container.querySelector('header') as HTMLElement
    const title = screen.getByText('侧边追问')

    fireEvent(title, pointer('pointerdown', 500, 200))
    fireEvent(bar, pointer('pointermove', 460, 190))
    fireEvent(bar, pointer('pointerup', 460, 190))

    expect(frameOf(container)).toMatchObject({
      left: `${expected.left - 40}px`,
      top: `${expected.top - 10}px`,
    })
  })

  it('keeps title-bar controls out of the drag gesture', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const reset = screen.getByRole('button', { name: '复位' })
    const close = screen.getByRole('button', { name: '关闭侧边追问' })

    fireEvent(reset, pointer('pointerdown', 500, 200))
    fireEvent(reset, pointer('pointermove', 400, 100))
    fireEvent(reset, pointer('pointerup', 400, 100))
    fireEvent(close, pointer('pointerdown', 400, 100))
    fireEvent(close, pointer('pointermove', 300, 60))
    fireEvent(close, pointer('pointerup', 300, 60))

    expect(frameOf(container)).toMatchObject({
      left: `${expected.left}px`,
      top: `${expected.top}px`,
    })
  })

  it('stops a drag at the viewport edge', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const handle = screen.getByRole('button', { name: '拖动窗口' })

    fireEvent(handle, pointer('pointerdown', 400, 300))
    fireEvent(handle, pointer('pointermove', -5_000, -5_000))
    fireEvent(handle, pointer('pointerup', -5_000, -5_000))

    expect(frameOf(container)).toMatchObject({ left: '0px', top: '0px' })
  })

  it('ignores drag movement before the pointer went down', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const handle = screen.getByRole('button', { name: '拖动窗口' })

    fireEvent(handle, pointer('pointermove', 10, 10))
    fireEvent(handle, pointer('pointerup', 10, 10))

    expect(frameOf(container)).toMatchObject({
      left: `${expected.left}px`,
      top: `${expected.top}px`,
    })
  })

  it('resizes the frame from a corner handle', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const corner = container.querySelector(
      '.dsh-sidecar-window-resize-se',
    ) as HTMLElement

    fireEvent(corner, pointer('pointerdown', 900, 700))
    fireEvent(corner, pointer('pointermove', 840, 640))
    fireEvent(corner, pointer('pointerup', 840, 640))

    expect(frameOf(container)).toMatchObject({
      height: `${expected.height - 60}px`,
      left: `${expected.left}px`,
      top: `${expected.top}px`,
      width: `${expected.width - 60}px`,
    })
  })

  it('resizes from the west edge without moving the east edge', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const west = container.querySelector('.dsh-sidecar-window-resize-w') as HTMLElement

    fireEvent(west, pointer('pointerdown', 500, 400))
    fireEvent(west, pointer('pointermove', 560, 400))
    fireEvent(west, pointer('pointerup', 560, 400))

    expect(frameOf(container)).toMatchObject({
      left: `${expected.left + 60}px`,
      width: `${expected.width - 60}px`,
    })
  })

  it('moves and resizes with the keyboard from the handle', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const handle = screen.getByRole('button', { name: '拖动窗口' })

    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(frameOf(container).left).toBe(`${expected.left - 16}px`)

    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    expect(frameOf(container).height).toBe(`${expected.height + 16}px`)

    fireEvent.keyDown(handle, { key: 'Tab' })
    expect(frameOf(container).height).toBe(`${expected.height + 16}px`)
  })

  it('restores the default frame on request', () => {
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)
    const handle = screen.getByRole('button', { name: '拖动窗口' })

    fireEvent(handle, pointer('pointerdown', 400, 300))
    fireEvent(handle, pointer('pointermove', 200, 100))
    fireEvent(handle, pointer('pointerup', 200, 100))
    expect(frameOf(container).left).not.toBe(`${expected.left}px`)

    fireEvent.click(screen.getByRole('button', { name: '复位' }))

    expect(frameOf(container)).toMatchObject({
      left: `${expected.left}px`,
      top: `${expected.top}px`,
    })
  })

  it('reopens at the frame the user left behind', () => {
    localStorage.setItem(
      SIDECAR_WINDOW_STORAGE_KEY,
      JSON.stringify({ height: 320, left: 40, top: 24, width: 480 }),
    )
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)

    expect(frameOf(container)).toEqual({
      height: '320px',
      left: '40px',
      top: '24px',
      width: '480px',
    })
  })

  it('clamps a stored frame that no longer fits the viewport', () => {
    localStorage.setItem(
      SIDECAR_WINDOW_STORAGE_KEY,
      JSON.stringify({ height: 4_000, left: 5_000, top: 5_000, width: 4_000 }),
    )
    const { container } = render(<SidecarDrawer {...props('approval', vi.fn())} />)

    expect(frameOf(container)).toEqual({
      height: `${window.innerHeight}px`,
      left: '0px',
      top: '0px',
      width: `${window.innerWidth}px`,
    })
  })
})
