import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidecarDrawer } from '../src/client/components/SidecarDrawer.js'
import type { SidecarDrawerProps } from '../src/client/components/SidecarDrawer.js'
import type { SidecarUiController } from '../src/client/controllers/sidecar-controller.js'

afterEach(cleanup)

function props(
  pendingInteraction: 'approval' | 'plan-review' | 'question',
  openSession: (sessionId: string) => void,
  overrides: {
    branchIds?: string[]
    childId?: string
    controller?: Partial<SidecarUiController>
  } = {},
): SidecarDrawerProps {
  const state = {
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
    close: vi.fn(),
    createBranch: vi.fn().mockResolvedValue('child'),
    getSnapshot: () => state,
    open: vi.fn(),
    selectBranch: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => undefined,
    ...overrides.controller,
  }

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
  it('switches existing branches and creates a new branch explicitly', () => {
    const selectBranch = vi.fn().mockResolvedValue(undefined)
    const createBranch = vi.fn().mockResolvedValue('new-child')
    render(
      <SidecarDrawer
        {...props('approval', vi.fn(), {
          branchIds: ['child', 'older'],
          controller: { createBranch, selectBranch },
        })}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: '侧边追问分支' }), {
      target: { value: 'older' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新建分支' }))

    expect(selectBranch).toHaveBeenCalledWith('older')
    expect(createBranch).toHaveBeenCalledTimes(1)
  })

  it('renames the current branch with an explicit title', async () => {
    const drawerProps = props('approval', vi.fn())
    const rename = vi.mocked(drawerProps.gateway.rename)
    render(<SidecarDrawer {...drawerProps} />)

    fireEvent.click(
      screen.getByRole('button', { name: '重命名当前分支' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: '分支名称' }), {
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
      screen.getByRole('button', { name: '归档当前分支' }),
    )
    expect(archiveCurrentBranch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认归档' }))
    expect(archiveCurrentBranch).toHaveBeenCalledTimes(1)
  })
})
