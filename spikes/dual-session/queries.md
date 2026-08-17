# Live public-contract queries

Record exact results from the `0.1.0-rc.6` runtime. Do not replace missing contracts with guesses.

## Client services

- [x] Session runtime/list service: `ctx.sessions.list`, `open`, `fork`, `binding`
- [x] Explicit Session binding or scope service: `ctx.sessions.scope(id)` and `binding(id)`
- [x] Remote call service: `ctx.connection.api.sessions.*`
- [x] Slot registry: `ctx.slots.inject(name, callback)` then `ctx.slots.register(...)`

## Client slots

- [x] Assistant message action slot: `conversation.chat.assistant-actions`
- [ ] Conversation overlay/drawer slot: no dedicated public drawer slot was found
- [x] Session-scoped surface slot: `conversation.session` exists, but it is bound to the single staged/current Session
- [x] Props and registration protocol for the selected action slot

## Host operations

- [x] Fork an active Session: `ctx.sessions.fork({ sessionId, atSeq, increaseTitle })`
- [x] Prompt a Session by id: `ctx.sessions.binding(id)?.session.prompt(...)` or `ctx.connection.api.sessions.prompt(...)`
- [ ] Subscribe/open an event window by id: public runtime window follows only the staged/current Session
- [x] Cancel a child turn: `ctx.connection.api.sessions.cancel({ sessionId })`
- [ ] Close/release a child event window: not applicable because no second runtime window can be opened
- [ ] Select a per-Session preset or tool policy: no public enforcement contract verified

## Recorded contracts

```text
Provider: @deepseek-ai/dsh-client-runtime/client
Method or slot: ISessions.fork
Version/build: 0.1.0-rc.6
Exact signature: fork({ sessionId, atSeq?, increaseTitle? }): Promise<SessionId>
Observed availability: exported public type and successful live call
Notes: child is inserted into the Session list before the promise resolves; open() is separate.

Provider: @deepseek-ai/dsh-client-runtime/client
Method or slot: ISessions.binding / SessionFace.prompt
Version/build: 0.1.0-rc.6
Exact signature: binding(id): SessionBinding | undefined; prompt(content, 'queue' | 'steer'): Promise<RpcResult<{ accepted: true }>>
Observed availability: exported public type; equivalent shared connection call accepted a prompt for a non-current child
Notes: binding resolution has no staging or window side effects.

Provider: @deepseek-ai/dsh-client-connection/client
Method or slot: ConnectionHandle.api.sessions.history/prompt/cancel
Version/build: 0.1.0-rc.6
Exact signature: shared IApiClient unary methods using public request/response types
Observed availability: exported through ctx.connection and exercised against the live local Host
Notes: history can be polled for an arbitrary child without changing sessions.current.

Provider: @deepseek-ai/dsh-client-ui-conversation
Method or slot: conversation.chat.assistant-actions
Version/build: 0.1.0-rc.6
Exact props: AssistantActionOwnerProps { messageId } plus session standard props { sessionId, useSession, useProjection } and global standard props
Observed availability: exported SlotMap declaration; official message-feedback plugin registers into it
Notes: register only after slots.inject resolves; scope is session and kind is list.

Provider: @deepseek-ai/dsh-client-runtime/client
Method or slot: staged Session window
Version/build: 0.1.0-rc.6
Exact behavior: SessionRuntime.followCurrent() opens history only for list.current
Observed availability: public type comments and published bundle implementation agree
Notes: explicit binding is render-safe but does not stage or open the child's event window.
```

## Live RPC request format

Every unary request is a JSON `client-request` envelope posted to `/api/<method>`:

```json
{
  "type": "client-request",
  "rpcId": "<uuid>",
  "method": "workspace.create",
  "payload": { "path": "D:\\agent-study\\dsh-sidecar" }
}
```

The spike exercised `workspace.create`, `session.create`, `session.prompt`, `session.history`,
`session.list`, and `session.fork` through this public carrier.

## Evidence format

For every query, record:

```text
Provider:
Method or slot:
Version/build:
Exact signature or props:
Observed availability:
Notes:
```
