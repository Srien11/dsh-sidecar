import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChildProjectionSurface } from '../src/client/components/ChildProjectionSurface.js'
import type { SidecarHistoryReader } from '../src/client/controllers/harness-history-source.js'
import type { SidecarSessionGateway } from '../src/client/controllers/session-gateway.js'
import {
  SIDECAR_LOCALES,
  type SidecarTranslate,
} from '../src/client/locales.js'
import type { SidecarHistoryEvent } from '../src/host/derived-anchor-repository.js'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

const t = ((key: string) =>
  (SIDECAR_LOCALES.zh as Record<string, string>)[key] ?? key) as SidecarTranslate

function harness(excerpt?: string) {
  const gateway: SidecarSessionGateway = {
    cancel: vi.fn(),
    closeChildSurface: vi.fn(),
    fork: vi.fn(),
    openChildSurface: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn(),
  }
  const history: SidecarHistoryReader = {
    history: vi.fn().mockResolvedValue([]),
  }

  render(
    <ChildProjectionSurface
      afterSeq={10}
      {...(excerpt === undefined ? { childSessionId: 'child' } : {})}
      {...(excerpt === undefined ? {} : { excerpt })}
      gateway={gateway}
      history={history}
      {...(excerpt === undefined
        ? {}
        : { prompt: (text: string) => gateway.prompt('child', text) })}
      running={false}
      t={t}
    />,
  )

  return {
    gateway,
    textarea: screen.getByRole('textbox', { name: '侧边追问' }),
  }
}

describe('ChildProjectionSurface composer', () => {
  it('renders assistant Markdown as semantic content instead of source markers', async () => {
    const history: SidecarHistoryReader = {
      history: vi.fn().mockResolvedValue([
        {
          data: {
            message: {
              content: [
                {
                  text: [
                    '## HTTP/2 差异',
                    '',
                    '**规范层面**：支持多路复用。',
                    '',
                    '- 不使用 `Transfer-Encoding`',
                    '- 使用帧传输',
                    '',
                    '```http',
                    'cache-control: no-cache',
                    '```',
                  ].join('\n'),
                  type: 'text',
                },
              ],
              id: 'answer-markdown',
            },
            step: 1,
            turn: 2,
          },
          seq: 11,
          type: 'assistant/message',
        },
      ]),
    }

    render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child"
        gateway={{
          cancel: vi.fn(),
          closeChildSurface: vi.fn(),
          fork: vi.fn(),
          openChildSurface: vi.fn(),
          prompt: vi.fn(),
          rename: vi.fn(),
        }}
        history={history}
        running={false}
        t={t}
      />,
    )

    expect(
      await screen.findByRole('heading', { level: 2, name: 'HTTP/2 差异' }),
    ).toBeTruthy()
    expect(screen.getByText('规范层面').tagName).toBe('STRONG')
    expect(screen.getByText('Transfer-Encoding').tagName).toBe('CODE')
    expect(screen.getByText('cache-control: no-cache').closest('pre')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('## HTTP/2 差异')).toBeNull()
  })

  it('keeps user-authored Markdown markers as plain text', async () => {
    const history: SidecarHistoryReader = {
      history: vi.fn().mockResolvedValue([
        {
          data: { content: [{ text: '## 只是用户输入', type: 'text' }] },
          seq: 11,
          type: 'user/message',
        },
      ]),
    }

    render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child"
        gateway={{
          cancel: vi.fn(),
          closeChildSurface: vi.fn(),
          fork: vi.fn(),
          openChildSurface: vi.fn(),
          prompt: vi.fn(),
          rename: vi.fn(),
        }}
        history={history}
        running={false}
        t={t}
      />,
    )

    expect(await screen.findByText('## 只是用户输入')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '只是用户输入' })).toBeNull()
  })

  it('shows the selected excerpt above an empty composer and sends it as context', async () => {
    const test = harness('第一行\n第二行')

    expect(screen.getByText(/第一行\s+第二行/)).toBeTruthy()
    expect((test.textarea as HTMLTextAreaElement).value).toBe('')

    fireEvent.change(test.textarea, { target: { value: '为什么？' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() =>
      expect(test.gateway.prompt).toHaveBeenCalledWith(
        'child',
        [
          '<dsh-sidecar-selected-context>',
          '第一行',
          '第二行',
          '</dsh-sidecar-selected-context>',
          '',
          '为什么？',
        ].join('\n'),
      ),
    )
  })

  it('shows an immediate responding state after the prompt is accepted', async () => {
    const test = harness()
    fireEvent.change(test.textarea, { target: { value: '请回答' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('AI 正在回复…')).toBeTruthy()
  })

  it('shows a restored excerpt without attaching it to later prompts again', async () => {
    const gateway = {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn(),
      openChildSurface: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn(),
    }
    render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child"
        excerpt="之前选中的原文"
        gateway={gateway}
        history={{ history: vi.fn().mockResolvedValue([]) }}
        running={false}
        t={t}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: '侧边追问' }), {
      target: { value: '继续解释' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() =>
      expect(gateway.prompt).toHaveBeenCalledWith('child', '继续解释'),
    )
    expect(screen.getByText('之前选中的原文')).toBeTruthy()
  })

  it('polls rapidly while waiting for the active turn to finish', async () => {
    vi.useFakeTimers()
    const history: SidecarHistoryReader = {
      history: vi.fn().mockResolvedValue([]),
    }
    const gateway = {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn(),
      openChildSurface: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn(),
    }
    render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child"
        gateway={gateway}
        history={history}
        running={false}
        t={t}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: '侧边追问' }), {
      target: { value: '请回答' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(vi.mocked(history.history).mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('renders growing assistant chunks during the active turn', async () => {
    const firstChunk: SidecarHistoryEvent = {
      data: {
        chunk: { text: '第一', type: 'text-delta' },
        step: 1,
        turn: 2,
      },
      seq: 11,
      type: 'assistant/chunk',
    }
    const secondChunk: SidecarHistoryEvent = {
      data: {
        chunk: { text: '段', type: 'text-delta' },
        step: 1,
        turn: 2,
      },
      seq: 12,
      type: 'assistant/chunk',
    }
    const history: SidecarHistoryReader = {
      history: vi
        .fn()
        .mockResolvedValueOnce([firstChunk])
        .mockResolvedValue([firstChunk, secondChunk]),
    }
    render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child"
        gateway={{
          cancel: vi.fn(),
          closeChildSurface: vi.fn(),
          fork: vi.fn(),
          openChildSurface: vi.fn(),
          prompt: vi.fn(),
          rename: vi.fn(),
        }}
        history={history}
        running
        t={t}
      />,
    )

    expect(await screen.findByText('第一')).toBeTruthy()
    expect(await screen.findByText('第一段', {}, { timeout: 1_000 })).toBeTruthy()
  })

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

  it('does not overlap history polls while the previous read is pending', async () => {
    vi.useFakeTimers()
    const pending = deferred<readonly []>()
    const history: SidecarHistoryReader = {
      history: vi.fn().mockReturnValue(pending.promise),
    }
    const gateway = {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn(),
      openChildSurface: vi.fn(),
      prompt: vi.fn(),
    }

    render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child"
        gateway={gateway}
        history={history}
        running={false}
        t={t}
      />,
    )
    await Promise.resolve()
    expect(history.history).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(history.history).toHaveBeenCalledTimes(1)

    pending.resolve([])
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(history.history).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(history.history).toHaveBeenCalledTimes(2)
  })

  it('does not let an old child response replace the current child transcript', async () => {
    const first = deferred<readonly SidecarHistoryEvent[]>()
    const history: SidecarHistoryReader = {
      history: vi.fn((sessionId) =>
        sessionId === 'child-a'
          ? first.promise
          : Promise.resolve([
              {
                data: { content: [{ text: '来自 B', type: 'text' }] },
                seq: 11,
                type: 'user/message',
              },
            ]),
      ),
    }
    const gateway = {
      cancel: vi.fn(),
      closeChildSurface: vi.fn(),
      fork: vi.fn(),
      openChildSurface: vi.fn(),
      prompt: vi.fn(),
    }
    const view = render(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child-a"
        gateway={gateway}
        history={history}
        running={false}
        t={t}
      />,
    )

    view.rerender(
      <ChildProjectionSurface
        afterSeq={10}
        childSessionId="child-b"
        gateway={gateway}
        history={history}
        running={false}
        t={t}
      />,
    )
    await waitFor(() => expect(screen.getByText('来自 B')).toBeTruthy())

    first.resolve([
      {
        data: { content: [{ text: '来自 A', type: 'text' }] },
        seq: 11,
        type: 'user/message',
      },
    ])
    await Promise.resolve()

    expect(screen.queryByText('来自 A')).toBeNull()
    expect(screen.getByText('来自 B')).toBeTruthy()
  })
})
