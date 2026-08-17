import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChildProjectionSurface } from '../src/client/components/ChildProjectionSurface.js'
import type { SidecarHistoryReader } from '../src/client/controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../src/client/controllers/session-gateway.js'

afterEach(cleanup)

function harness() {
  const gateway: SidecarSessionGateway = {
    cancel: vi.fn(),
    closeChildSurface: vi.fn(),
    fork: vi.fn(),
    openChildSurface: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
  }
  const history: SidecarHistoryReader = {
    history: vi.fn().mockResolvedValue([]),
  }

  render(
    <ChildProjectionSurface
      afterSeq={10}
      childSessionId="child"
      gateway={gateway}
      history={history}
      running={false}
    />,
  )

  return {
    gateway,
    textarea: screen.getByRole('textbox', { name: '侧边追问' }),
  }
}

describe('ChildProjectionSurface composer', () => {
  it('sends the trimmed draft when Enter is pressed', async () => {
    const test = harness()
    fireEvent.change(test.textarea, { target: { value: '  为什么？  ' } })

    fireEvent.keyDown(test.textarea, { key: 'Enter' })

    await waitFor(() =>
      expect(test.gateway.prompt).toHaveBeenCalledWith('child', '为什么？'),
    )
    expect((test.textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('keeps Shift+Enter available for a newline', () => {
    const test = harness()
    fireEvent.change(test.textarea, { target: { value: '第一行' } })

    fireEvent.keyDown(test.textarea, { key: 'Enter', shiftKey: true })

    expect(test.gateway.prompt).not.toHaveBeenCalled()
  })

  it('does not submit while an IME composition is active', () => {
    const test = harness()
    fireEvent.change(test.textarea, { target: { value: '中文输入' } })

    fireEvent.keyDown(test.textarea, {
      key: 'Enter',
      isComposing: true,
    })

    expect(test.gateway.prompt).not.toHaveBeenCalled()
  })

  it('continues to send when the send button is clicked', async () => {
    const test = harness()
    fireEvent.change(test.textarea, { target: { value: '按钮发送' } })

    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() =>
      expect(test.gateway.prompt).toHaveBeenCalledWith('child', '按钮发送'),
    )
  })
})
