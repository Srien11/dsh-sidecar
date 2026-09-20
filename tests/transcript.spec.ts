import { describe, expect, it } from 'vitest'

import { buildTranscript } from '../src/client/controllers/transcript.js'
import type { SidecarHistoryEvent } from '../src/host/derived-anchor-repository.js'

function event(
  seq: number,
  type: string,
  data?: Record<string, unknown>,
): SidecarHistoryEvent {
  return { data, seq, type }
}

describe('buildTranscript', () => {
  it('projects only child-authored messages after the inherited boundary', () => {
    const events = [
      event(8, 'user/message', {
        content: [{ type: 'text', text: '父会话里的问题' }],
      }),
      event(9, 'assistant/message', {
        message: {
          id: 'inherited-answer',
          content: [{ type: 'text', text: '父会话里的回答' }],
        },
        step: 1,
        turn: 1,
      }),
      event(10, 'turn/end', { reason: { kind: 'completed' }, turn: 1 }),
      event(11, 'user/message', {
        content: [{ type: 'text', text: '只展开第二点' }],
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'user-11',
        role: 'user',
        seq: 11,
        text: '只展开第二点',
      },
    ])
  })

  it('accumulates text deltas while an assistant answer is still streaming', () => {
    const events = [
      event(12, 'assistant/chunk', {
        chunk: { index: 0, text: '第一段', type: 'text-delta' },
        step: 1,
        turn: 2,
      }),
      event(13, 'assistant/chunk', {
        chunk: { index: 0, text: '第二段', type: 'text-delta' },
        step: 1,
        turn: 2,
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'partial-2:1',
        pending: true,
        role: 'assistant',
        seq: 13,
        text: '第一段第二段',
      },
    ])
  })

  it('hides selected-context metadata from the visible user message', () => {
    const events = [
      event(11, 'user/message', {
        content: [
          {
            type: 'text',
            text: [
              '<dsh-sidecar-selected-context>',
              '不应出现在抽屉里的选中文字',
              '</dsh-sidecar-selected-context>',
              '',
              '请解释原因',
            ].join('\n'),
          },
        ],
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'user-11',
        role: 'user',
        seq: 11,
        text: '请解释原因',
      },
    ])
  })

  it('never projects reasoning deltas into the visible transcript', () => {
    const events = [
      event(12, 'assistant/chunk', {
        chunk: {
          index: 0,
          text: 'We need answer in Chinese.',
          type: 'reasoning-delta',
        },
        step: 1,
        turn: 2,
      }),
      event(13, 'assistant/chunk', {
        chunk: { index: 0, text: '最终回答', type: 'text-delta' },
        step: 1,
        turn: 2,
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'partial-2:1',
        pending: true,
        role: 'assistant',
        seq: 13,
        text: '最终回答',
      },
    ])
  })

  it('replaces streamed text with the finalized assistant message', () => {
    const events = [
      event(12, 'assistant/chunk', {
        chunk: { index: 0, text: '草稿', type: 'text-delta' },
        step: 1,
        turn: 2,
      }),
      event(13, 'assistant/message', {
        message: {
          id: 'answer-2',
          content: [{ type: 'text', text: '完整回答' }],
        },
        step: 1,
        turn: 2,
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'answer-2',
        role: 'assistant',
        seq: 13,
        text: '完整回答',
      },
    ])
  })

  it('summarizes tool calls without exposing raw arguments', () => {
    const events = [
      event(14, 'tool/call', {
        arguments: '{"path":"secret.txt"}',
        callId: 'call-1',
        name: 'read_file',
        step: 1,
        turn: 2,
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'tool-14',
        role: 'tool',
        seq: 14,
        text: '调用工具：read_file',
      },
    ])
  })

  it('shows the durable failure message from an errored turn', () => {
    const events = [
      event(15, 'turn/end', {
        reason: {
          error: { code: 'RATE_LIMIT', message: '请求过于频繁' },
          kind: 'error',
        },
        turn: 2,
      }),
    ]

    expect(buildTranscript(events, 10)).toEqual([
      {
        id: 'error-15',
        role: 'error',
        seq: 15,
        text: '请求过于频繁',
      },
    ])
  })

  it('does not expose provider diagnostics from authentication failures', () => {
    const events = [
      event(16, 'turn/end', {
        reason: {
          error: {
            code: 'AUTH',
            message: 'Invalid API key sk-secret-value',
          },
          kind: 'error',
        },
        turn: 2,
      }),
    ]

    const transcript = buildTranscript(events, 10)

    expect(transcript).toEqual([
      {
        id: 'error-16',
        role: 'error',
        seq: 16,
        text: 'API key 无效或未配置。',
      },
    ])
    expect(transcript[0]?.text).not.toContain('sk-secret-value')
  })

  it('hides the frozen main-history envelope from the child transcript', () => {
    const events = [
      event(1, 'user/message', {
        content: [
          {
            type: 'text',
            text: [
              '<dsh-sidecar-frozen-history>',
              '用户：原问题',
              '助手（输出中）：快照回答',
              '</dsh-sidecar-frozen-history>',
              '',
              '用户追问：',
              '为什么？',
            ].join('\n'),
          },
        ],
      }),
    ]

    expect(buildTranscript(events, 0)).toEqual([
      { id: 'user-1', role: 'user', seq: 1, text: '为什么？' },
    ])
  })
})
