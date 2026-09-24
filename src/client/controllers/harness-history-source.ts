import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  SessionAssistantStreamAttempt,
  SessionFollowFrame,
} from '@deepseek-ai/dsh-api-session-controller/types'

import type {
  DerivedAnchorSource,
  SidecarHistoryEvent,
} from '../../host/derived-anchor-repository.js'

export interface SidecarHistoryReader {
  history(sessionId: string): Promise<readonly SidecarHistoryEvent[]>
}

/** Reads complete public Session history, following backward pages defensively. */
export class HarnessHistorySource
  implements DerivedAnchorSource, SidecarHistoryReader
{
  constructor(
    private readonly sessions: ISessions,
    private readonly remote: ClientRemote,
  ) {}

  async parentId(childSessionId: string): Promise<string | undefined> {
    return this.sessions.list.getSnapshot().byId[childSessionId as SessionId]?.parentId
  }

  async history(sessionId: string): Promise<readonly SidecarHistoryEvent[]> {
    const events = new Map<number, SidecarHistoryEvent>()
    const opening = await this.openingSnapshot(sessionId)
    for (const record of opening.records) events.set(record.event.seq, record.event)
    const activeAttempt = opening.assistantStream?.activeAttempt
    if (activeAttempt !== undefined) {
      for (const event of streamingEvents(opening.cursor, activeAttempt)) {
        events.set(event.seq, event)
      }
    }
    let beforeSeq = opening.records[0]?.event.seq

    for (let page = 0; opening.hasMore && page < 100; page += 1) {
      if (beforeSeq === undefined) break
      const response = await this.remote.session.page({
        address: { kind: 'session', sessionId: sessionId as SessionId },
        beforeSeq,
        maxMessages: 200,
        throughSeq: opening.cursor,
      })
      if (!response.ok) {
        throw new Error(
          `Reading sidecar history failed: ${response.error.code}: ${response.error.message}`,
        )
      }

      const pageEvents = response.value.records.map(({ event }) => event)
      for (const event of pageEvents) events.set(event.seq, event)
      if (!response.value.hasMore || pageEvents.length === 0) break

      const oldest = Math.min(...pageEvents.map((event) => event.seq))
      if (beforeSeq !== undefined && oldest >= beforeSeq) {
        throw new Error('Sidecar history pagination did not advance')
      }
      beforeSeq = oldest
    }

    return [...events.values()].sort((left, right) => left.seq - right.seq)
  }

  private async openingSnapshot(
    sessionId: string,
  ): Promise<Extract<SessionFollowFrame, { type: 'snapshot' }>> {
    const abort = new AbortController()
    try {
      for await (const frame of this.remote.session.follow(
        {
          address: { kind: 'session', sessionId: sessionId as SessionId },
          assistantStream: true,
          maxMessages: 200,
        },
        abort.signal,
      )) {
        if (frame.type === 'snapshot') return frame
      }
      throw new Error(`Session history stream closed before snapshot: ${sessionId}`)
    } finally {
      abort.abort()
    }
  }
}

function streamingEvents(
  cursor: number,
  attempt: SessionAssistantStreamAttempt,
): SidecarHistoryEvent[] {
  return attempt.stream.map((chunk, index) => ({
    data: { chunk, step: attempt.step, turn: attempt.turn },
    seq: cursor + (index + 1) / (attempt.stream.length + 1),
    type: 'assistant/chunk',
  }))
}
