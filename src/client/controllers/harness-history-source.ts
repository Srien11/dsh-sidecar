import type {
  IApiClient,
  SessionId,
} from '@deepseek-ai/dsh-client-connection/client'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'

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
    private readonly api: IApiClient,
  ) {}

  async parentId(childSessionId: string): Promise<string | undefined> {
    return this.sessions.list.getSnapshot().byId[childSessionId as SessionId]?.parentId
  }

  async history(sessionId: string): Promise<readonly SidecarHistoryEvent[]> {
    const events = new Map<number, SidecarHistoryEvent>()
    let beforeSeq: number | undefined

    for (let page = 0; page < 100; page += 1) {
      const response = await this.api.sessions.history({
        ...(beforeSeq === undefined ? {} : { beforeSeq }),
        maxMessages: 200,
        sessionId: sessionId as SessionId,
      })
      if (!response.result.ok) {
        throw new Error(
          `Reading sidecar history failed: ${response.result.error.code}: ${response.result.error.message}`,
        )
      }

      const pageEvents = response.result.value.events.map(({ event }) => event)
      for (const event of pageEvents) events.set(event.seq, event)
      if (!response.result.value.hasMore || pageEvents.length === 0) break

      const oldest = Math.min(...pageEvents.map((event) => event.seq))
      if (beforeSeq !== undefined && oldest >= beforeSeq) {
        throw new Error('Sidecar history pagination did not advance')
      }
      beforeSeq = oldest
    }

    return [...events.values()].sort((left, right) => left.seq - right.seq)
  }
}
