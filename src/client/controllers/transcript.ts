import type { SidecarHistoryEvent } from '../../host/derived-anchor-repository.js'

export interface SidecarTranscriptMessage {
  id: string
  role: 'assistant' | 'error' | 'tool' | 'user'
  seq: number
  text: string
  pending?: boolean
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function textContent(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((part) => {
      const block = object(part)
      return block?.type === 'text' && typeof block.text === 'string' ? block.text : ''
    })
    .filter(Boolean)
    .join('\n')
}

function messageText(data: Record<string, unknown>): string {
  return textContent(data.content) || textContent(object(data.message)?.content)
}

function failureText(
  reason: Record<string, unknown>,
  failure: Record<string, unknown> | undefined,
): string {
  const code = String(failure?.code ?? reason.code ?? '')
  if (/AUTH|CREDENTIAL|API[_ -]?KEY/i.test(code)) {
    return 'API key 无效或未配置。'
  }
  return typeof failure?.message === 'string'
    ? failure.message
    : '本次追问执行失败。'
}

/** Small, tolerant projection for the non-staged child history in ADR 0001 A2. */
export function buildTranscript(
  events: readonly SidecarHistoryEvent[],
  afterSeq: number,
): SidecarTranscriptMessage[] {
  const messages: SidecarTranscriptMessage[] = []
  const partials = new Map<string, SidecarTranscriptMessage>()

  for (const event of events) {
    if (event.seq <= afterSeq) continue
    const data = object(event.data) ?? {}

    if (event.type === 'user/message') {
      const text = messageText(data)
      if (text !== '') {
        messages.push({ id: `user-${event.seq}`, role: 'user', seq: event.seq, text })
      }
      continue
    }

    if (event.type === 'assistant/chunk') {
      const chunk = object(data.chunk)
      if (
        (chunk?.type === 'text-delta' || chunk?.type === 'reasoning-delta') &&
        typeof chunk.text === 'string'
      ) {
        const key = `${String(data.turn)}:${String(data.step)}`
        const current = partials.get(key) ?? {
          id: `partial-${key}`,
          pending: true,
          role: 'assistant' as const,
          seq: event.seq,
          text: '',
        }
        current.text += chunk.text
        current.seq = event.seq
        partials.set(key, current)
      }
      continue
    }

    if (event.type === 'assistant/message') {
      const text = messageText(data)
      if (text !== '') {
        messages.push({
          id: String(data.id ?? object(data.message)?.id ?? `assistant-${event.seq}`),
          role: 'assistant',
          seq: event.seq,
          text,
        })
      }
      partials.delete(`${String(data.turn)}:${String(data.step)}`)
      continue
    }

    if (event.type === 'tool/call') {
      const name = String(data.name ?? object(data.call)?.name ?? 'tool')
      messages.push({
        id: `tool-${event.seq}`,
        role: 'tool',
        seq: event.seq,
        text: `调用工具：${name}`,
      })
      continue
    }

    if (event.type === 'turn/end') {
      const reason = object(data.reason)
      const failure = object(reason?.error) ?? object(reason?.failure)
      if (reason?.kind === 'error') {
        messages.push({
          id: `error-${event.seq}`,
          role: 'error',
          seq: event.seq,
          text: failureText(reason, failure),
        })
      }
    }
  }

  messages.push(...partials.values())
  return messages.sort((left, right) => left.seq - right.seq)
}
