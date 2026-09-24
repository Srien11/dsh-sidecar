# dsh-sidecar

[简体中文](README.md) | [English](README.en.md)

dsh-sidecar brings a Codex-like contextual follow-up experience to DeepSeek Harness. Select any part of an AI response and ask about it immediately from a lightweight action beside the selection. With no selection, the original action at the end of the response remains available for a whole-answer follow-up.

Every new follow-up runs in its own persistent child Session. Final answers use a native fork; a still-running answer freezes the visible history at click time and seeds an independent Session that never synchronizes with later main-thread output. Neither path appends messages to the main conversation.

The answer-tail control now lists every follow-up by summary (the question that opened it) instead of “Follow-up 1 / 2”; text that was followed up mid-answer keeps a yellow highlight that links back to that follow-up; and the panel is a floating window you can drag, resize from eight directions, and leave wherever you like — it never has to cover the text you are reading.

## Why it helps

- **Stay on the main thread:** verify a detail, explain code, or explore an alternative without disrupting the primary conversation.
- **Ask precisely:** preserve the selected punctuation, line breaks, and code without copying and pasting.
- **Keep follow-ups independent:** save multiple follow-up paths from the same answer without mixing them in one panel.
- **Read summaries, not numbers:** the answer-tail list shows each follow-up's first question, and marks which one is currently open.
- **The original text is the entry point:** followed-up text stays yellow-highlighted; click it (or focus it and press `Enter`/`Space`) to reopen that follow-up, and repeated wording still resolves to the right occurrence.
- **Never cover the answer:** drag, resize, and reset the floating window; its position and size are remembered.
- **Feel native:** follow Harness language, light/dark theme, focus behavior, and permission boundaries.

`Select an answer excerpt → Click “Ask follow-up” beside it → Continue in the floating window → Close and resume later from the highlight or the tail summary`

> Status: `0.1.0-beta.0`, targeting `@deepseek-ai/dsh@0.1.5-rc.3`. The core flow has been verified in a real Harness installation and HTTP smoke test. The current automated regression suite contains 165 tests and passes type checking, build, and bundle-contract verification. Harness is still in preview, so future release candidates may introduce breaking changes.

## Features

- Shows an immediate floating follow-up action for a valid selection inside the current finalized Assistant response; the answer tail keeps the whole-answer action and now lists each existing follow-up by summary.
- Keeps a yellow highlight on the exact excerpt a selection follow-up was opened from: hover or focus it to read “Open follow-up: summary”, then click or press `Enter`/`Space` to reopen that follow-up. The offset recorded at creation time resolves repeated wording to the intended occurrence.
- Makes the panel a floating window: drag anywhere on the title bar (the left grip doubles as the keyboard entry) to move it, resize from any of the four edges and four corners, and press “Reset” for the default frame. With the grip focused, arrow keys move it and `Shift`+arrows resize it, and the geometry is stored in browser-local storage.
- Shows “Ask current output” beside the composer as soon as a running answer has visible text, without waiting for completion.
- Rejects selections from other messages or elsewhere on the page and preserves exact punctuation, line breaks, and code. The selected excerpt stays visible and persisted at the top of the window, but is never prefilled into the composer or mixed into projected messages.
- Opens the panel without creating a Session. The first submitted prompt creates and hides the child without switching the active main Session. Final answers fork at their completed boundary; running answers create an independent blank Session seeded only with the click-time visible-history snapshot.
- Every click on “Ask follow-up” starts a separate follow-up; existing follow-ups are restored individually from the answer-tail summary list or from their highlight in the answer.
- Renames the current follow-up and requires confirmation before archiving it.
- Displays only new child history in the window, without repeating inherited context.
- Shows “AI is responding…” immediately after prompt acceptance and refreshes growing answers every 250ms during an active turn, together with tool summaries and turn errors.
- Surfaces pending approval, question, and plan-confirmation states, with an explicit option to open the native child Session when required.
- Closing the window or pressing `Escape` only hides it; the child remains available for later recovery.
- Restores focus to the originating answer action or highlight after the panel closes.
- Follows Harness English/Chinese locale and light/dark theme tokens.
- Persists the minimal `childId -> anchor` record through the official `storageDomain`, including the first-question summary plus the selected excerpt and its character offset; ordinary Harness forks are never mistaken for sidecar branches.
- Keeps system-hidden sidecars indexed for counts and recovery until the user explicitly archives them.
- Cleans up registered slots, polling, highlights, and style nodes when the plugin unloads.

## Installation

The beta is not published to npm yet. A source installation requires Node.js `^22.19.0 || >=24.0.0`, pnpm `11.7.0`, and DeepSeek Harness `0.1.5-rc.3`:

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

1. Open a conversation with a running or finalized AI response.
2. While it is running, click “Ask current output” beside the composer; the window keeps exactly the history visible at that moment.
3. After completion, select text and use the action beside the selection, or use the action at the end of the response.
4. Add your question and press `Enter` to send, or `Shift+Enter` for a new line. The main Session remains selected and unchanged.
5. Drag anywhere on the title bar to move the window off the text, resize it from an edge or corner, and press “Reset” to return to the default frame; the geometry is remembered.
6. The answer-tail list names every follow-up by summary and highlights the one currently open; text you followed up on stays yellow-highlighted and reopens its follow-up when clicked.
7. Rename or archive the current follow-up from the window header.
8. Close the window or press `Escape`; reopen it later from the highlight, the tail summary, or the same answer's action.

## Isolation boundary

dsh-sidecar isolates conversation records. Follow-up prompts and responses live only in a hidden child Session and never automatically append to, truncate, rename, or archive the parent Session.

Tool side effects are not isolated. Parent and child Sessions may share the same workspace, filesystem, and external services. If a child is allowed to call a write-capable tool, its effects remain visible to the main workspace. Use Harness permission modes to control tool access.

## How it works

The plugin uses only public Harness `0.1.5-rc.3` interfaces:

- `sessions.fork` creates persistent children;
- `uiWorkspace.connectWorkspace` creates an independent same-workspace child for running answers;
- `remote.session.follow` and `remote.session.page` project child history and the active response stream;
- `SessionFace.prompt`, `cancel`, and `rename` drive the child;
- `workspaces.archiveSession` hides children from regular conversation groups;
- `storageDomain` and a Harness-authenticated Fetch route persist branch anchors, including the first-question summary plus the selected excerpt and its character offset;
- `conversation.chat.assistant-actions` injects the answer actions, the tail summary list, and the in-answer highlight entries;
- `conversation.input.right` injects the running-answer action;
- `shell.overlay` hosts the draggable floating window.

The window uses a lightweight history projection instead of mounting a second native Conversation surface or changing the active main Session. The side child reads history through the public Session snapshot and pagination interfaces, then refreshes the active turn every 250ms for near-real-time incremental output.

## Development verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm pack --dry-run
```

The 165 tests cover anchor storage/transport, sidecar identity and archival boundaries, atomic forks, streaming-history freezing, immediate exact selections and selection offsets, in-answer highlights and entries (repeated wording, cross-block skipping, cleanup restoration), follow-up summary lists and label fallbacks, floating-window geometry (drag, resize, keyboard, clamping, persistence), independent follow-up recovery, active-turn refresh, focus, bilingual dictionaries, theme contracts, and child transcript projection.

These commands reuse the existing `node_modules`. A complete Harness installation and browser smoke test are separate release checks, not routine local regression steps.

## Documentation

- [Official plugin requirements and exposure](docs/research/official-plugin-requirements.md)
- [Product specification](docs/product-spec.md)
- [Concurrent Session technical decision](docs/decisions/0001-concurrent-session-surface.md)
- [Anchor persistence technical decision](docs/decisions/0002-anchor-persistence.md)
- [Real dual-Session verification results](docs/research/dual-session-spike-results.md)
- [Detailed implementation plan (English)](docs/plans/2026-08-17-dsh-sidecar.md)
- [Detailed implementation plan (Chinese)](docs/plans/2026-08-17-dsh-sidecar.zh.md)
- [Follow-up summaries, in-answer highlights, and floating window plan](docs/plans/2026-08-31-follow-up-summary-and-floating-window.zh.md)

## License

[MIT](LICENSE)
