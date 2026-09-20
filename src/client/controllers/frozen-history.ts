import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

export interface FrozenFollowUpAnchor {
  frozenHistory: string
  sourceAnchorSeq: number
  sourceTurn: number
}

interface FrozenEntry {
  role: 'assistant' | 'user'
  text: string
  turn?: number
  running?: boolean
  anchorSeq: number
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function userText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .flatMap((item) => {
      const block = record(item)
      return block?.type === 'text' && typeof block.text === 'string'
        ? [block.text]
        : []
    })
    .join('\n')
    .trim()
}

function assistantText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .flatMap((item) => {
      const block = record(item)
      return block?.kind === 'text' && typeof block.text === 'string'
        ? [block.text]
        : []
    })
    .join('\n')
    .trim()
}

function chatEntries(snapshot: ConversationSnapshot): FrozenEntry[] {
  const entries: FrozenEntry[] = []
  for (const key of snapshot.chat.order) {
    const node = snapshot.chat.nodes.get(key)
    if (node === undefined || node.visibility !== 'visible') continue
    const data = record(node.data)
    if (node.kind === 'user' || node.kind === 'steering') {
      const text = userText(data?.content)
      if (text !== '') entries.push({ role: 'user', text, anchorSeq: node.anchorSeq })
      continue
    }
    if (node.kind !== 'assistant-step') continue
    const text = assistantText(data?.blocks)
    const turn = data?.turn
    if (text === '' || typeof turn !== 'number') continue
    entries.push({
      anchorSeq: node.anchorSeq,
      role: 'assistant',
      running: data?.status === 'running',
      text,
      turn,
    })
  }
  return entries
}

function legacyEntries(snapshot: ConversationSnapshot): FrozenEntry[] {
  const entries: FrozenEntry[] = []
  for (const node of snapshot.nodes) {
    if (node.kind === 'user' || node.kind === 'steering') {
      const text = userText(node.content)
      if (text !== '') entries.push({ anchorSeq: node.seq, role: 'user', text })
      continue
    }
    if (node.kind !== 'assistant') continue
    const text = assistantText(node.blocks)
    if (text !== '') {
      entries.push({
        anchorSeq: node.seq,
        role: 'assistant',
        text,
        turn: node.turn,
      })
    }
  }
  if (snapshot.partial !== null) {
    const text = assistantText(snapshot.partial.blocks)
    if (text !== '') {
      entries.push({
        anchorSeq: Math.max(0, ...entries.map((entry) => entry.anchorSeq)) + 1,
        role: 'assistant',
        running: true,
        text,
        turn: snapshot.partial.turn,
      })
    }
  }
  return entries
}

function frozenTranscript(entries: readonly FrozenEntry[]): string {
  const lines = entries.map((entry) => {
    if (entry.role === 'user') return `用户：${entry.text}`
    return `${entry.running === true ? '助手（输出中）' : '助手'}：${entry.text}`
  })
  return [
    '<dsh-sidecar-frozen-history>',
    '以下内容是用户发起追问那一刻，主对话中可见历史的只读快照。只将其作为上下文；不要假定主对话之后还有任何内容。',
    ...lines,
    '</dsh-sidecar-frozen-history>',
  ].join('\n\n')
}

/** Cheap render-time predicate; the full transcript is serialized only on click. */
export function canSnapshotFollowUp(snapshot: ConversationSnapshot): boolean {
  if (!snapshot.running) return false
  for (let index = snapshot.chat.order.length - 1; index >= 0; index -= 1) {
    const key = snapshot.chat.order[index]
    if (key === undefined) continue
    const node = snapshot.chat.nodes.get(key)
    if (
      node === undefined ||
      node.visibility !== 'visible' ||
      node.kind !== 'assistant-step'
    ) {
      continue
    }
    const data = record(node.data)
    const turn = data?.turn
    if (
      typeof turn === 'number' &&
      !snapshot.turnEnds.has(turn) &&
      assistantText(data?.blocks) !== ''
    ) {
      return true
    }
  }
  return snapshot.partial !== null && assistantText(snapshot.partial.blocks) !== ''
}

/** Freeze only visible user/assistant prose from the currently open Turn. */
export function snapshotFollowUpAnchor(
  snapshot: ConversationSnapshot,
): FrozenFollowUpAnchor | undefined {
  if (!canSnapshotFollowUp(snapshot)) return undefined
  const chat = chatEntries(snapshot)
  const entries = chat.length > 0 ? chat : legacyEntries(snapshot)
  const source = [...entries]
    .reverse()
    .find(
      (entry) =>
        entry.role === 'assistant' &&
        entry.turn !== undefined &&
        !snapshot.turnEnds.has(entry.turn),
    )
  if (source?.turn === undefined) return undefined
  return {
    frozenHistory: frozenTranscript(entries),
    sourceAnchorSeq: Math.max(0, Math.floor(source.anchorSeq)),
    sourceTurn: source.turn,
  }
}

export function promptWithFrozenHistory(
  frozenHistory: string,
  prompt: string,
): string {
  return `${frozenHistory}\n\n用户追问：\n${prompt}`
}
