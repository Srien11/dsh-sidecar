# Dual-Session feasibility spike

This spike decides whether `dsh-sidecar` can render and drive a child Session while the parent Session remains current.

## Baseline

- DeepSeek Harness: `0.1.0-rc.6`
- Node.js: bundled Codex runtime, currently `v24.19.0`
- pnpm: bundled Codex runtime, currently `11.19.0`
- Profile data: `.spike/dsh-home` through `DSH_HOME`
- Bind address: `127.0.0.1`

The `.spike/` directory is ignored and must never be committed because it may contain local profile state or credentials.

## Environment check

```powershell
./spikes/dual-session/check-environment.ps1
```

The command reports only whether `DEEPSEEK_API_KEY` exists; it never prints the key.

## Start the isolated Harness

```powershell
./spikes/dual-session/start-harness.ps1 -Port 0
```

Port `0` asks the operating system to choose a free port. Record the printed URL and build information in `docs/research/dual-session-spike-results.md`.

## Pass criteria for native dual-session rendering

All conditions must pass using exported/public contracts:

1. Forking produces an addressable child without changing the current parent selection.
2. A prompt can be sent to the non-current child.
3. The child event stream can be observed while the parent stream remains mounted.
4. Streaming text, cancellation, reconnection, and tool presentation work in the child surface.
5. Disposing the spike plugin releases every child subscription.

Any private import, DOM patch, or unavoidable selection switch fails the native route.
