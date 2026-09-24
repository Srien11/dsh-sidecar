import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientRemote, RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  ISessions,
  SessionFace,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  IWorkspaces,
  WorkspaceId,
} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'

export interface SidecarSessionGateway {
  createIndependent(parentSessionId: string): Promise<{ childId: string }>
  fork(input: { sessionId: string; atSeq: number }): Promise<{ childId: string }>
  openChildSurface(childId: string): Promise<void>
  closeChildSurface(childId: string): Promise<void>
  prompt(childId: string, text: string): Promise<void>
  cancel(childId: string): Promise<void>
  rename(childId: string, title: string): Promise<void>
}

function rpcError(operation: string, error: RemoteFailure): Error {
  return new Error(`${operation} failed: ${error.code}: ${error.message}`)
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Harness can create the fork successfully and then fail while attaching it
 * to the workspace. The structured error still carries the durable child id;
 * treating that case as an unknown outcome would create another copy on retry.
 */
function publishedForkChildId(error: unknown): string | undefined {
  const rpc = record(record(error)?.rpcError)
  if (
    rpc?.code !== 'workspace-attach-failed' &&
    rpc?.code !== 'session/workspace-attach-failed'
  ) return undefined
  const sessionId = record(rpc.details)?.sessionId
  return typeof sessionId === 'string' && sessionId.length > 0
    ? sessionId
    : undefined
}

const ADDRESSABILITY_RETRY_DELAYS_MS = [0, 50, 100, 200, 400, 800] as const

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/** Public-API adapter selected by ADR 0001 route A2. */
export class HarnessSessionGateway implements SidecarSessionGateway {
  constructor(
    private readonly sessions: ISessions,
    private readonly remote: ClientRemote,
    private readonly uiWorkspace: UiWorkspace,
    private readonly workspaces?: IWorkspaces,
  ) {}

  async createIndependent(parentSessionId: string): Promise<{ childId: string }> {
    if (this.workspaces === undefined) {
      throw new Error('Creating an independent sidecar requires Workspaces')
    }
    const workspace = this.workspaces.list
      .getSnapshot()
      .items.find((item) => item.sessionIds.includes(parentSessionId as SessionId))
    if (workspace === undefined) {
      throw new Error(`Parent session has no workspace: ${parentSessionId}`)
    }
    const childId = await this.uiWorkspace.connectWorkspace(
      workspace.workspaceId as WorkspaceId,
    )
    if (childId === parentSessionId) {
      throw new Error('Workspace returned the active parent instead of a blank session')
    }
    return { childId }
  }

  async fork(input: { sessionId: string; atSeq: number }): Promise<{ childId: string }> {
    try {
      const childId = await this.sessions.fork({
        atSeq: input.atSeq,
        increaseTitle: false,
        sessionId: input.sessionId as SessionId,
      })
      return { childId }
    } catch (error) {
      const childId = publishedForkChildId(error)
      if (childId !== undefined) return { childId }
      throw error
    }
  }

  async openChildSurface(childId: string): Promise<void> {
    // Addressability probe only. It deliberately does not call sessions.open().
    // A just-created fork may take a short moment to become history-readable.
    let failure: RemoteFailure | undefined
    for (const delay of ADDRESSABILITY_RETRY_DELAYS_MS) {
      if (delay > 0) await wait(delay)
      const abort = new AbortController()
      try {
        for await (const frame of this.remote.session.follow(
          {
            address: { kind: 'session', sessionId: childId as SessionId },
            maxMessages: 1,
          },
          abort.signal,
        )) {
          if (frame.type === 'snapshot') return
        }
      } catch (error) {
        const remote = record(error)
        if (
          typeof remote?.code === 'string' &&
          typeof remote.message === 'string'
        ) {
          failure = remote as unknown as RemoteFailure
        } else {
          throw error
        }
      } finally {
        abort.abort()
      }
    }
    if (failure !== undefined) throw rpcError('Opening sidecar', failure)
  }

  async closeChildSurface(_childId: string): Promise<void> {
    // The projection controller owns polling resources; Harness owns the Session.
  }

  async prompt(childId: string, text: string): Promise<void> {
    const result = await this.sessionFace(childId).prompt(
      [{ text, type: 'text' }],
      'queue',
    )
    if (!result.ok) throw rpcError('Sending sidecar prompt', result.error)
  }

  async cancel(childId: string): Promise<void> {
    const result = await this.sessionFace(childId).cancel()
    if (!result.ok) throw rpcError('Cancelling sidecar turn', result.error)
  }

  async rename(childId: string, title: string): Promise<void> {
    const result = await this.sessionFace(childId).rename(title)
    if (!result.ok) throw rpcError('Renaming sidecar', result.error)
  }

  private sessionFace(childId: string): SessionFace {
    const binding = this.sessions.binding(childId as SessionId)
    if (binding === undefined) {
      throw new Error(`Sidecar session is not addressable: ${childId}`)
    }
    return binding.session
  }
}
