import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { describe, expect, it } from 'vitest'

import {
  promptWithFrozenHistory,
  snapshotFollowUpAnchor,
} from '../src/client/controllers/frozen-history.js'

function snapshot(runningText = '正在生成的结论'): ConversationSnapshot {
  const nodes = new Map<string, unknown>([
    [
      'user-1',
      {
        anchorSeq: 1,
        data: { content: [{ text: '原始问题', type: 'text' }] },
        kind: 'user',
        visibility: 'visible',
      },
    ],
    [
      'assistant-1',
      {
        anchorSeq: 4,
        data: {
          blocks: [
            { kind: 'reasoning', text: '不应复制的推理' },
            { kind: 'text', text: runningText },
          ],
          status: 'running',
          step: 0,
          turn: 2,
        },
        kind: 'assistant-step',
        visibility: 'visible',
      },
    ],
  ])
  return {
    chat: {
      nodes: { get: (key: string) => nodes.get(key) },
      order: ['user-1', 'assistant-1'],
    },
    nodes: [],
    partial: null,
    running: true,
    turnEnds: new Map(),
  } as unknown as ConversationSnapshot
}

describe('frozen streaming history', () => {
  it('captures only visible user and assistant prose at the current open turn', () => {
    const anchor = snapshotFollowUpAnchor(snapshot())

    expect(anchor).toEqual({
      frozenHistory: expect.stringContaining('用户：原始问题'),
      sourceAnchorSeq: 4,
      sourceTurn: 2,
    })
    expect(anchor?.frozenHistory).toContain('助手（输出中）：正在生成的结论')
    expect(anchor?.frozenHistory).not.toContain('不应复制的推理')
  })

  it('keeps the captured string unchanged when the main answer later grows', () => {
    const frozen = snapshotFollowUpAnchor(snapshot('第一段'))
    const later = snapshotFollowUpAnchor(snapshot('第一段和后来新增的第二段'))

    expect(frozen?.frozenHistory).toContain('第一段')
    expect(frozen?.frozenHistory).not.toContain('后来新增')
    expect(later?.frozenHistory).toContain('后来新增')
  })

  it('does not offer a snapshot follow-up after the parent stops running', () => {
    const settled = { ...snapshot(), running: false }
    expect(snapshotFollowUpAnchor(settled)).toBeUndefined()
  })

  it('places the follow-up after the immutable history envelope', () => {
    expect(promptWithFrozenHistory('<history>', '为什么？')).toBe(
      '<history>\n\n用户追问：\n为什么？',
    )
  })
})
