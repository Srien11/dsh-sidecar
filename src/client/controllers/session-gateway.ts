import type {
  IApiClient,
  RpcError,
  SessionId,
} from '@deepseek-ai/dsh-client-connection/client'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'

export interface SidecarSessionGateway {
  fork(input: { sessionId: string; atSeq: number }): Promise<{ childId: string }>
  openChildSurface(childId: string): Promise<void>
  closeChildSurface(childId: string): Promise<void>
  prompt(childId: string, text: string): Promise<void>
  cancel(childId: string): Promise<void>
}

function rpcError(operation: string, error: RpcError): Error {
  return new Error(`${operation} failed: ${error.code}: ${error.message}`)
}

/** Public-API adapter selected by ADR 0001 route A2. */
export class HarnessSessionGateway implements SidecarSessionGateway {
  constructor(
    private readonly sessions: ISessions,
    private readonly api: IApiClient,
  ) {}

  async fork(input: { sessionId: string; atSeq: number }): Promise<{ childId: string }> {
    const childId = await this.sessions.fork({
      atSeq: input.atSeq,
      increaseTitle: false,
      sessionId: input.sessionId as SessionId,
    })
    return { childId }
  }

  async openChildSurface(childId: string): Promise<void> {
    // Addressability probe only. It deliberately does not call sessions.open().
    const response = await this.api.sessions.history({
      maxMessages: 1,
      sessionId: childId as SessionId,
    })
    if (!response.result.ok) throw rpcError('Opening sidecar', response.result.error)
  }

  async closeChildSurface(_childId: string): Promise<void> {
    // The projection controller owns polling resources; Harness owns the Session.
  }

  async prompt(childId: string, text: string): Promise<void> {
    const response = await this.api.sessions.prompt({
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      content: [{ text, type: 'text' }],
      mode: 'queue',
      sessionId: childId as SessionId,
    })
    if (!response.result.ok) throw rpcError('Sending sidecar prompt', response.result.error)
  }

  async cancel(childId: string): Promise<void> {
    const response = await this.api.sessions.cancel({
      sessionId: childId as SessionId,
    })
    if (!response.result.ok) throw rpcError('Cancelling sidecar turn', response.result.error)
  }
}
