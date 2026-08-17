import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidecarDrawer } from '../src/client/components/SidecarDrawer.js'
import type { SidecarDrawerProps } from '../src/client/components/SidecarDrawer.js'
import type { SidecarUiController } from '../src/client/controllers/sidecar-controller.js'

afterEach(cleanup)

function props(
  pendingInteraction: 'approval' | 'plan-review' | 'question',
  openSession: (sessionId: string) => void,
): SidecarDrawerProps {
  const state = {
    childId: 'child',
    parentId: 'parent',
    status: 'open' as const,
    turnEndSeq: 10,
  }
  const controller: SidecarUiController = {
    branchCount: vi.fn(),
    close: vi.fn(),
    getSnapshot: () => state,
    open: vi.fn(),
    subscribe: () => () => undefined,
  }

  return {
    controller,
    gateway: {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn(),
      openChildSurface: vi.fn(),
      prompt: vi.fn(),
    },
    history: { history: vi.fn().mockResolvedValue([]) },
    openSession,
    useSessions: (selector: (snapshot: unknown) => unknown) =>
      selector({
        byId: {
          child: { pendingInteraction, running: true },
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
