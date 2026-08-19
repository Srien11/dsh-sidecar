# dsh-sidecar

[简体中文](README.md) | [English](README.en.md)

dsh-sidecar brings a Codex-like contextual follow-up experience to DeepSeek Harness. Select any part of an AI response and ask about it immediately from a lightweight action beside the selection. With no selection, the original action at the end of the response remains available for a whole-answer follow-up.

Every follow-up runs in its own persistent child Session. It inherits the complete conversation through the selected answer without navigating away from, duplicating, or appending messages to the main conversation. Multiple exploration branches can coexist and be resumed, renamed, or archived at any time.

## Why it helps

- **Stay on the main thread:** verify a detail, explain code, or explore an alternative without disrupting the primary conversation.
- **Ask precisely:** preserve the selected punctuation, line breaks, and code without copying and pasting.
- **Keep durable branches:** save multiple independent follow-up paths from the same answer and return to them later.
- **Feel native:** follow Harness language, light/dark theme, focus behavior, and permission boundaries.

`Select an answer excerpt → Click “Ask follow-up” beside it → Continue in the right panel → Close and resume later`

> Status: `0.1.0-beta.0`, targeting `@deepseek-ai/dsh@0.1.0-rc.6`. The core flow has been verified in a real Harness installation and browser smoke test. The current automated regression suite contains 87 tests and passes type checking, build, and bundle-contract verification. Harness is still in preview, so future release candidates may introduce breaking changes.

## Features

- Shows an immediate floating follow-up action for a valid selection inside the current finalized Assistant response; the answer-tail action and persistent branch count remain available.
- Rejects selections from other messages or elsewhere on the page and preserves exact punctuation, line breaks, and code.
- Opens the panel without creating a Session. The first submitted prompt forks from the selected answer boundary, then hides the child from the regular conversation list without switching the active main Session.
- Supports multiple persistent branches from one answer, including selecting an existing branch or explicitly creating a new one.
- Renames branches and requires confirmation before archiving; after archival, it switches to a remaining branch automatically.
- Displays only new child history in the right-side drawer, without repeating inherited context.
- Streams child responses, tool summaries, and turn errors directly in the panel.
- Surfaces pending approval, question, and plan-confirmation states, with an explicit option to open the native child Session when required.
- Closing the drawer or pressing `Escape` only hides it; the child remains available for later recovery.
- Restores focus to the originating answer action after the panel closes.
- Follows Harness English/Chinese locale and light/dark theme tokens.
- Persists the minimal `childId -> anchor` record through the official `storageDomain`; ordinary Harness forks are never mistaken for sidecar branches.
- Keeps system-hidden sidecars indexed for counts and recovery until the user explicitly archives them.
- Cleans up registered slots, polling, and style nodes when the plugin unloads.

## Installation

The beta is not published to npm yet. A source installation requires Node.js `^22.19.0 || >=24.0.0`, pnpm `11.7.0`, and DeepSeek Harness `0.1.0-rc.6`:

```powershell
git clone https://github.com/Srien11/dsh-sidecar.git
cd dsh-sidecar
pnpm install
pnpm build
dsh plugin --profile web add link:D:\absolute\path\to\dsh-sidecar
```

Restart the Web profile after installation. Once the package is published to npm, installation will become:

```sh
dsh plugin --profile web add dsh-sidecar
```

## Usage

1. Open a conversation containing a finalized AI response.
2. For a focused follow-up, select text inside that response and click the action that appears beside the selection.
3. With no selection, click the action at the end of the response to ask about the whole answer.
4. Add your question and press `Enter` to send, or `Shift+Enter` for a new line. The main Session remains selected and unchanged.
5. Use the panel header to select, create, rename, or archive branches.
6. Close the panel or press `Escape`; click the same answer again whenever you want to resume.

## Isolation boundary

dsh-sidecar isolates conversation records. Follow-up prompts and responses live only in a hidden child Session and never automatically append to, truncate, rename, or archive the parent Session.

Tool side effects are not isolated. Parent and child Sessions may share the same workspace, filesystem, and external services. If a child is allowed to call a write-capable tool, its effects remain visible to the main workspace. Use Harness permission modes to control tool access.

## How it works

The plugin uses only public Harness `0.1.0-rc.6` interfaces:

- `sessions.fork` creates persistent children;
- `sessions.history` projects child history;
- `SessionFace.prompt`, `cancel`, and `rename` drive the child;
- `workspaces.archiveSession` hides children from regular conversation groups;
- `storageDomain` and the plugin RPC channel persist branch anchors;
- `conversation.chat.assistant-actions` injects answer actions;
- `shell.overlay` hosts the drawer.

The current Client Runtime can stage only one native Session surface at a time. The drawer therefore uses a lightweight history projection instead of mounting a second native Conversation surface or changing `sessions.current`.

## Development verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm pack --dry-run
```

The 87 tests cover anchor storage/RPC, sidecar identity and archival boundaries, atomic forks, immediate exact selections, multi-branch management, focus, bilingual dictionaries, theme contracts, and child transcript projection.

These commands reuse the existing `node_modules`. A complete Harness installation and browser smoke test are separate release checks, not routine local regression steps.

## Documentation

- [Official plugin requirements and exposure](docs/research/official-plugin-requirements.md)
- [Product specification](docs/product-spec.md)
- [Concurrent Session technical decision](docs/decisions/0001-concurrent-session-surface.md)
- [Anchor persistence technical decision](docs/decisions/0002-anchor-persistence.md)
- [Real dual-Session verification results](docs/research/dual-session-spike-results.md)
- [Detailed implementation plan (English)](docs/plans/2026-08-17-dsh-sidecar.md)
- [Detailed implementation plan (Chinese)](docs/plans/2026-08-17-dsh-sidecar.zh.md)

## License

[MIT](LICENSE)
