# dsh-sidecar Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an installable DeepSeek Harness Web plugin that opens persistent follow-up conversations in a side drawer while preserving the parent conversation's visible state and event log.

**Architecture:** Reuse Harness `session.fork` and normal Session persistence. Put all unstable Harness calls behind a small adapter, keep branch indexing and UI state as pure domain code, and register UI only through public Client slots. A mandatory Phase 0 spike selects the rendering strategy because the current Client Runtime documents a single staged Session occupant; no implementation may depend on private modules or DOM patching.

**Tech Stack:** TypeScript 6.0, React 18, Cordis 4.0.1, DeepSeek Harness 0.1.0-rc.6 client packages, tsdown 0.22, Vitest 4.1, Testing Library, Playwright 1.49, pnpm 11.7, Node.js 22.19+/24+.

---

## Feasibility statement

This project is feasible in layers, not yet proven as one indivisible package:

- **Confirmed by official implementation:** completed-turn Session fork, inherited context, child persistence, unchanged parent event history, Web Client bundles/slots, and profile installation.
- **Conditionally feasible:** a drawer shell, branch navigation, close/reopen state, and preserving the visible parent position.
- **Not yet proven through public APIs:** two fully interactive native Session surfaces in one page, with simultaneous streaming, tool cards, cancellation, and reconnect.

If native dual-Session rendering fails but the frozen-parent route succeeds, the MVP may ship with the parent visible and state-preserved but read-only while the sidecar is open. If the requirement is that both panes remain fully interactive at the same time, Gate A must pass route A or route B; otherwise the project is a No-Go rather than a private-API workaround.

## Product invariants

Every implementation task must preserve these invariants:

1. Fork only at a completed Assistant turn boundary.
2. Never append, truncate, rename, archive, or otherwise mutate the parent Session as a side effect of creating or using a sidecar.
3. Closing the drawer only changes UI state; it never deletes the child Session.
4. A child prompt is addressed only to the child Session.
5. A failed or ambiguous fork is never automatically retried.
6. Uninstalling the plugin leaves child Sessions readable as ordinary Harness Sessions.
7. No private import path, DOM selector injection, monkey patch, or guessed slot contract is permitted.
8. Tool-side effects are not described as isolated unless an actual public policy API enforces that claim.

## Planned repository shape

```text
dsh-sidecar/
├── .github/workflows/ci.yml
├── docs/
│   ├── decisions/
│   ├── plans/
│   ├── research/
│   └── screenshots/
├── scripts/
│   ├── check-bundle.mjs
│   ├── check-release.mjs
│   └── clean.mjs
├── spikes/dual-session/
├── src/
│   ├── client/
│   │   ├── components/
│   │   ├── controllers/
│   │   ├── index.ts
│   │   └── locales.ts
│   ├── domain/
│   ├── host/
│   ├── css-modules.d.ts
│   └── index.ts
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   └── integration/
├── cordis.patch.yml
├── package.json
├── tsconfig.json
├── tsdown.config.ts
└── vitest.config.ts
```

## Release gates

- **Gate A — second Session surface:** select route A, B, or C in ADR 0001 using a real Harness build.
- **Gate B — safe capability statement:** either enforce a read-only child policy with a public API or state clearly that only conversation history is isolated.
- **Gate C — restart durability:** parent and child remain readable after a full `dsh` process restart.
- **Gate D — packed install:** install the generated `.tgz` into a clean `web` profile and pass an end-to-end smoke test.
- **Gate E — discoverability:** public repository, GitHub `dsh-plugin` topic, npm metadata, bilingual README, demo media, release notes.

### Task 1: Run the dual-Session feasibility spike

**Files:**
- Create: `spikes/dual-session/README.md`
- Create: `spikes/dual-session/queries.md`
- Create: `spikes/dual-session/result-template.md`
- Create: `docs/research/dual-session-spike-results.md`
- Modify: `docs/decisions/0001-concurrent-session-surface.md`

**Step 1: Install the exact test baseline in an isolated profile**

Run:

```sh
npx @deepseek-ai/dsh@0.1.0-rc.6 web
```

Expected: Web UI starts and reports Harness `0.1.0-rc.6`. Record the actual profile path and build hash in `dual-session-spike-results.md`.

**Step 2: Record the live public contracts before writing plugin code**

Use the running Harness Cordis inspection workflow to query:

- Client Services containing `session`, `runtime`, `slots`, and `remote`.
- The complete slot subtree under the conversation root.
- Exact standard props for Assistant message actions, conversation overlays, and session-scoped surfaces.
- Host methods for fork, prompt, subscribe/open, close, archive, and preset/tool policy.

Write the raw provider name, method signature, slot protocol, scope, and version to `spikes/dual-session/queries.md`. Do not summarize away missing capabilities.

**Step 3: Test creation without navigation**

From a completed Assistant answer, call the public fork operation with `increaseTitle: false`. Assert:

```text
parent session id before === parent session id after
child summary is addressable
child.parentId === parent.id
parent lastSeq before === parent lastSeq after
```

Expected: PASS. If selection changes automatically and no public way prevents it, record route A as failed.

**Step 4: Test prompting a non-current child**

Attempt to send a prompt to the child while the parent remains current. Observe child streaming and cancellation through public subscriptions only.

Expected for route A: child accepts the prompt; parent remains current; both event streams remain independently readable. Any need to import an unexported module fails route A.

**Step 5: Test two simultaneous render surfaces**

Mount a minimal second session surface in a disposable client plugin. Verify streaming text, tool cards, retry state, reconnect, and cleanup after plugin disposal.

Expected for route A: both surfaces update without tearing, current selection does not move, and all subscriptions are released on dispose.

**Step 6: Evaluate route B and route C if route A fails**

- Route B: verify same-origin embedding, exact session route, CSP, focus traversal, and connection isolation.
- Route C: verify frozen parent snapshot, draft preservation, scroll restoration, and parent reopen after child close.

Do not evaluate route D unless the product scope is explicitly renegotiated.

**Step 7: Decide and commit the ADR**

Update ADR 0001 status to `Accepted`, identify the chosen route, quote the observed public contract, and list rejected routes with evidence.

Run:

```sh
git add spikes/dual-session docs/research/dual-session-spike-results.md docs/decisions/0001-concurrent-session-surface.md
git commit -m "docs: decide sidecar session rendering strategy"
```

### Task 2: Convert the planning repository into a buildable plugin package

**Files:**
- Modify: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `tsdown.config.ts`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `src/client/index.ts`
- Create: `src/css-modules.d.ts`
- Create: `cordis.patch.yml`
- Create: `scripts/clean.mjs`
- Create: `scripts/check-bundle.mjs`

**Step 1: Write a manifest contract test**

Create `tests/manifest.spec.ts` that loads `package.json` and asserts:

```ts
expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
expect(pkg.dsh.client.platform).toBe('web')
expect(pkg.exports['./client']).toBeDefined()
expect(pkg.files).toContain('cordis.patch.yml')
expect(pkg.keywords).toContain('dsh-plugin')
```

**Step 2: Run the test and verify failure**

Run: `pnpm vitest run tests/manifest.spec.ts`  
Expected: FAIL because the planning manifest has no build or DSH declarations.

**Step 3: Replace the planning manifest with the publishable shape**

Use this dependency baseline:

```json
{
  "name": "dsh-sidecar",
  "version": "0.1.0-beta.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-client-ui-slots"
      ]
    }
  }
}
```

Pin all `@deepseek-ai/*` peer and dev dependencies to the exact RC accepted by Task 1. Start with `0.1.0-rc.6`; change it only when spike evidence requires a different version.

**Step 4: Add minimal Host and Client plugins**

`src/index.ts` must export a named Cordis function plugin with no behavior beyond lifecycle-safe registration. `src/client/index.ts` must do the same for the browser bundle. `cordis.patch.yml` must compose the package once.

**Step 5: Build and inspect the bundle**

Run:

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/check-bundle.mjs
pnpm pack --dry-run
```

Expected: Host entry, Client entry, declarations, patch, README, LICENSE, and no source-only files appear in the tarball list.

**Step 6: Commit**

```sh
git add package.json pnpm-workspace.yaml tsconfig.json tsdown.config.ts vitest.config.ts src cordis.patch.yml scripts tests/manifest.spec.ts
git commit -m "build: scaffold installable dsh web plugin"
```

### Task 3: Define the stable sidecar domain model

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/branch-index.ts`
- Create: `src/domain/errors.ts`
- Test: `tests/branch-index.spec.ts`

**Step 1: Write failing branch-index tests**

Cover:

- zero children for an answer;
- two children at the same anchor;
- children of different parent Sessions never mix;
- subagent descendants are excluded;
- missing parents and lineage cycles fail soft;
- stable ordering by creation time and id;
- archived children remain known but are hidden by the active projection.

Use a Harness-independent input type:

```ts
export interface SidecarSessionSummary {
  id: string
  parentId?: string
  seedLength?: number
  origin?: string
  createdAt: number
  archived: boolean
}

export interface SidecarAnchor {
  parentSessionId: string
  turnEndSeq: number
  seedLength: number
}
```

**Step 2: Run and verify failure**

Run: `pnpm vitest run tests/branch-index.spec.ts`  
Expected: FAIL with missing `buildBranchIndex`.

**Step 3: Implement a pure derived index**

Implement `buildBranchIndex(summaries, anchors)` without React or Cordis imports. Return maps keyed by `(parentSessionId, turnEndSeq)` and by child Session id.

**Step 4: Run the tests**

Run: `pnpm vitest run tests/branch-index.spec.ts`  
Expected: PASS.

**Step 5: Commit**

```sh
git add src/domain tests/branch-index.spec.ts
git commit -m "feat: derive sidecar branches from session lineage"
```

### Task 4: Implement durable anchor association without corrupting Session logs

**Files:**
- Create: `src/host/anchor-repository.ts`
- Create: `src/host/derived-anchor-repository.ts`
- Create conditionally: `src/host/profile-anchor-repository.ts`
- Test: `tests/anchor-repository.spec.ts`
- Modify: `docs/decisions/0002-anchor-persistence.md`

**Step 1: Prove whether `parentId + seedLength` is sufficient**

Create fixtures with multi-step turns, tool events, steering, and paginated history. Derive the clicked Assistant turn's `turn/end` from the child `seedLength` and parent event window.

Expected: deterministic mapping after complete parent history is available.

**Step 2: Choose persistence strategy**

- Prefer derivation from official lineage metadata.
- If derivation is ambiguous, persist `{childId,parentId,turnEndSeq}` in a plugin-owned profile store through a public Host service.
- Do not add a custom Session event until cold-read compatibility, `ignorable` semantics, and uninstall behavior are proven.

**Step 3: Write repository contract tests**

The contract must survive process recreation, reject child/parent mismatches, and treat missing metadata as recoverable rather than inventing an anchor.

**Step 4: Implement the smallest passing repository**

Expose:

```ts
interface AnchorRepository {
  get(childSessionId: string): Promise<SidecarAnchor | undefined>
  put(childSessionId: string, anchor: SidecarAnchor): Promise<void>
  remove(childSessionId: string): Promise<void>
}
```

**Step 5: Commit**

```sh
git add src/host tests/anchor-repository.spec.ts docs/decisions/0002-anchor-persistence.md
git commit -m "feat: persist sidecar anchor associations"
```

### Task 5: Add a Harness adapter and atomic fork coordinator

**Files:**
- Create: `src/client/controllers/session-gateway.ts`
- Create: `src/client/controllers/fork-controller.ts`
- Test: `tests/fork-controller.spec.ts`

**Step 1: Write failing behavior tests**

Test that the controller:

- forwards the exact parent id and Assistant anchor seq;
- always uses `increaseTitle: false`;
- records the anchor only after the child is locally addressable;
- keeps one in-flight request per anchor;
- never auto-retries timeout or partial-success responses;
- returns an existing plugin-created child when the user chooses it;
- leaves parent selection untouched on success and failure.

**Step 2: Define a narrow adapter instead of spreading DSH calls across UI**

```ts
export interface SidecarSessionGateway {
  fork(input: { sessionId: string; atSeq: number }): Promise<{ childId: string }>
  openChildSurface(childId: string): Promise<void>
  closeChildSurface(childId: string): Promise<void>
  prompt(childId: string, text: string): Promise<void>
  cancel(childId: string): Promise<void>
}
```

The concrete adapter must be written from Task 1's observed public API, not from guessed internal imports.

**Step 3: Implement `ForkController`**

Use an in-flight map keyed by `${parentId}:${turnEndSeq}` and clear it in `finally`. On ambiguous errors, surface “检查现有分支后再试” rather than retrying.

**Step 4: Verify**

Run: `pnpm vitest run tests/fork-controller.spec.ts`  
Expected: PASS.

**Step 5: Commit**

```sh
git add src/client/controllers tests/fork-controller.spec.ts
git commit -m "feat: coordinate atomic sidecar forks"
```

### Task 6: Register the Assistant answer action

**Files:**
- Create: `src/client/components/SidecarAction.tsx`
- Create: `src/client/components/SidecarAction.module.css`
- Modify: `src/client/index.ts`
- Test: `tests/sidecar-action.spec.tsx`

**Step 1: Write failing component tests**

Assert:

- no action for an open turn;
- no action for a User or steering message;
- enabled action for a completed Assistant tail;
- branch count is visible after at least one child exists;
- click sends exact `sessionId` and `turnEndSeq` once;
- disabled and busy states expose `aria-disabled` and localized descriptions.

**Step 2: Query and document the exact slot**

Copy the Task 1 slot name, registration protocol, owner props, and standard props into a source comment. If the slot disappeared in the pinned RC, stop and update the compatibility decision.

**Step 3: Implement the component and registration**

Use `slots.inject(...)` and return the disposer from `slots.register(...)`. Do not query DOM nodes or replace the entire Assistant bubble.

**Step 4: Run tests**

Run: `pnpm vitest run tests/sidecar-action.spec.tsx`  
Expected: PASS.

**Step 5: Commit**

```sh
git add src/client/components src/client/index.ts tests/sidecar-action.spec.tsx
git commit -m "feat: add sidecar action to completed answers"
```

### Task 7: Build the drawer shell and preserve parent view state

**Files:**
- Create: `src/client/components/SidecarDrawer.tsx`
- Create: `src/client/components/SidecarDrawer.module.css`
- Create: `src/client/controllers/drawer-controller.ts`
- Create: `src/client/controllers/parent-view-state.ts`
- Test: `tests/sidecar-drawer.spec.tsx`
- Test: `tests/parent-view-state.spec.ts`

**Step 1: Write failing UI-state tests**

Cover closed/open/creating/error states, switching among multiple children, escape-to-close, focus return, and click-outside behavior. Closing must not call archive or remove.

**Step 2: Write failing parent-state tests**

Capture and restore:

```ts
interface ParentViewState {
  sessionId: string
  scrollAnchorNodeId?: string
  scrollOffset: number
  draft: string
  focusedElement?: 'composer' | 'message-action' | 'other'
}
```

Test restore after child close, page resize, and failed child open.

**Step 3: Implement the drawer shell**

- Desktop width: clamp between 360px and 48vw.
- Preserve a minimum main-content width.
- Use a modal-style focus boundary only if the chosen route overlays content; otherwise keep both panes in the document tab order.
- Add a visible close button and `Escape` handling.

**Step 4: Verify unit tests**

Run:

```sh
pnpm vitest run tests/sidecar-drawer.spec.tsx tests/parent-view-state.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/client/components src/client/controllers tests/sidecar-drawer.spec.tsx tests/parent-view-state.spec.ts
git commit -m "feat: add persistent sidecar drawer shell"
```

### Task 8: Integrate the chosen child Session renderer

**Files:**
- Create one of:
  - `src/client/components/NativeChildSurface.tsx`
  - `src/client/components/EmbeddedChildSurface.tsx`
  - `src/client/components/FrozenParentSurface.tsx`
- Modify: `src/client/components/SidecarDrawer.tsx`
- Create: `tests/child-surface.contract.tsx`
- Create: `tests/child-surface.spec.tsx`

**Step 1: Define a route-independent renderer contract**

```ts
interface ChildSurfaceProps {
  childSessionId: string
  onReady(): void
  onError(error: Error): void
  onRequestClose(): void
}
```

The contract tests must check ready, streaming, prompt submission, cancel, reconnect, and disposal.

**Step 2: Implement only the ADR-approved route**

- Route A: bind an explicit child Session through the verified public scope API.
- Route B: use the verified exact same-origin route and a schema-validated `postMessage` bridge restricted to `location.origin`.
- Route C: render the captured parent snapshot on the left and restore the parent when the child closes.

Delete spike-only code after the production adapter passes the contract.

**Step 3: Verify no parent mutation**

Record parent `lastSeq` before child prompts and compare it after child completion. Expected: unchanged.

**Step 4: Run contract tests**

Run: `pnpm vitest run tests/child-surface.spec.tsx`  
Expected: PASS for the selected route.

**Step 5: Commit**

```sh
git add src/client/components tests/child-surface.contract.tsx tests/child-surface.spec.tsx
git commit -m "feat: render child session in sidecar drawer"
```

### Task 9: Restore and manage persistent branches

**Files:**
- Create: `src/client/components/BranchTabs.tsx`
- Create: `src/client/components/BranchMenu.tsx`
- Create: `src/client/controllers/branch-controller.ts`
- Test: `tests/branch-controller.spec.ts`
- Test: `tests/branch-tabs.spec.tsx`

**Step 1: Write failing restoration tests**

Start from only persisted Session summaries and anchor data. Assert the action count, branch labels, last-selected child, and archived filtering reconstruct without creating a new Session.

**Step 2: Implement branch selection**

Support:

- open existing child;
- create another child at the same answer;
- rename child;
- archive child after explicit confirmation;
- jump to the parent anchor;
- recover an orphaned but readable child under an “unlinked” section.

**Step 3: Persist UI preference separately from conversation data**

Only `lastSelectedChildByAnchor` and drawer width belong to plugin UI storage. Child messages remain exclusively in Harness Session persistence.

**Step 4: Verify**

Run:

```sh
pnpm vitest run tests/branch-controller.spec.ts tests/branch-tabs.spec.tsx
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/client/components src/client/controllers tests/branch-controller.spec.ts tests/branch-tabs.spec.tsx
git commit -m "feat: restore and manage persistent sidecar branches"
```

### Task 10: Define and enforce the capability boundary

**Files:**
- Create: `src/domain/capability-policy.ts`
- Create conditionally: `src/host/readonly-preset.ts`
- Create: `src/client/components/CapabilityNotice.tsx`
- Test: `tests/capability-policy.spec.ts`
- Modify: `README.md`
- Modify: `SECURITY.md`

**Step 1: Write policy tests from Gate B evidence**

The policy result must be one of:

```ts
type IsolationLevel =
  | { kind: 'enforced-readonly'; blockedCapabilities: string[] }
  | { kind: 'conversation-only'; warning: string }
```

Never return `enforced-readonly` based only on UI intent.

**Step 2: Use a public per-Session policy API if Task 1 found one**

Create a sidecar preset/tool filter that excludes file writes, mutable shell, Git writes, messaging, payments, and external write tools. Test the actual tool schema visible to the child.

**Step 3: Otherwise ship an explicit conversation-only notice**

Display: “主对话记录不会改变；工具可能仍影响共享工作区。” Do not claim filesystem or external-action isolation in README or npm description.

**Step 4: Verify**

Run: `pnpm vitest run tests/capability-policy.spec.ts`  
Expected: PASS and wording matches the selected policy.

**Step 5: Commit**

```sh
git add src/domain src/host src/client/components tests/capability-policy.spec.ts README.md SECURITY.md
git commit -m "feat: make sidecar capability boundary explicit"
```

### Task 11: Add localization, accessibility, and responsive behavior

**Files:**
- Create or modify: `src/client/locales.ts`
- Modify: `src/client/components/*.tsx`
- Modify: `src/client/components/*.module.css`
- Test: `tests/accessibility.spec.tsx`
- Test: `tests/locales.spec.ts`

**Step 1: Define all user-facing strings in locale tables**

Include Chinese and English for create, creating, branch count, close, reopen, rename, archive, retry guidance, tool-side-effect warning, orphaned branch, and connection failure.

**Step 2: Write accessibility tests**

Check accessible names, focus entry/return, escape behavior, live-region announcements for streaming/error, and no keyboard trap between main conversation and drawer.

**Step 3: Implement responsive styles**

- Wide screens: side-by-side drawer.
- Narrow screens: overlay sheet while preserving parent state.
- Honor reduced motion and Harness theme tokens.
- Do not hard-code global colors.

**Step 4: Run tests**

Run:

```sh
pnpm vitest run tests/accessibility.spec.tsx tests/locales.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/client tests/accessibility.spec.tsx tests/locales.spec.ts
git commit -m "feat: localize and harden sidecar accessibility"
```

### Task 12: Add failure recovery and durability tests

**Files:**
- Create: `tests/integration/fork-persistence.spec.ts`
- Create: `tests/integration/restart-recovery.spec.ts`
- Create: `tests/integration/partial-success.spec.ts`
- Create: `tests/fixtures/sessions/`
- Modify: `src/client/controllers/fork-controller.ts`

**Step 1: Test process restart**

Create parent, fork child, send two child prompts, stop Harness, restart Harness, and reopen both.

Expected:

- parent transcript byte-equivalent before/after;
- child transcript contains inherited prefix plus two child turns;
- anchor association reconstructs;
- drawer can reopen the child without another fork.

**Step 2: Test partial success**

Simulate Host child publication followed by workspace attach or title failure. The controller must reconcile the returned child id and instruct the user to inspect existing branches instead of retrying.

**Step 3: Test disconnection during streaming**

Disconnect after partial Assistant chunks, reconnect, and verify one coherent child transcript with no duplicate user prompt.

**Step 4: Run integration tests**

Run: `pnpm vitest run tests/integration`  
Expected: PASS.

**Step 5: Commit**

```sh
git add src/client/controllers tests/integration tests/fixtures
git commit -m "test: cover sidecar recovery and persistence"
```

### Task 13: Add real-browser end-to-end coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/sidecar.spec.ts`
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/snapshots/`

**Step 1: Write the end-to-end scenario**

Automate:

1. open parent Session;
2. record parent id, scroll position, draft, and lastSeq;
3. create sidecar from an earlier completed answer;
4. ask two follow-ups;
5. close and reopen the drawer;
6. refresh the browser;
7. restart the Harness process;
8. reopen the same child;
9. verify parent id, draft, anchor, lastSeq, and transcript are unchanged.

**Step 2: Add keyboard-only and narrow-viewport flows**

Run the same open/close flow using Tab/Enter/Escape and at a mobile-width viewport.

**Step 3: Capture visual evidence**

Save screenshots for closed action, open drawer, multiple branch tabs, restored-after-refresh, and capability warning.

**Step 4: Run**

Run: `pnpm playwright test tests/e2e/sidecar.spec.ts`  
Expected: PASS with no console errors and stable screenshots.

**Step 5: Commit**

```sh
git add playwright.config.ts tests/e2e
git commit -m "test: verify sidecar flow in real harness web ui"
```

### Task 14: Add CI and packed-install verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/check-release.mjs`
- Create: `tests/integration/packed-install.ps1`
- Modify: `package.json`

**Step 1: Add local verification scripts**

Required commands:

```json
{
  "scripts": {
    "build": "pnpm run clean && tsc -p tsconfig.json && tsdown",
    "clean": "node scripts/clean.mjs",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "check:bundle": "node scripts/check-bundle.mjs",
    "release:check": "node scripts/check-release.mjs",
    "verify": "pnpm typecheck && pnpm test && pnpm build && pnpm check:bundle && pnpm release:check"
  }
}
```

**Step 2: Test a generated tarball**

Run:

```powershell
pnpm pack
./tests/integration/packed-install.ps1
```

The script must create a disposable DSH profile, install the exact `.tgz`, start Web UI, verify the Client bundle returns JavaScript rather than SPA HTML, and run the smoke flow.

**Step 3: Add CI matrix**

Run typecheck/test/build/pack on Node 22.19 and 24. Run real-browser smoke on Node 24. Cache pnpm by lockfile only.

**Step 4: Verify CI locally**

Run: `pnpm verify`  
Expected: PASS.

**Step 5: Commit**

```sh
git add .github package.json scripts tests/integration/packed-install.ps1
git commit -m "ci: verify build and packed dsh installation"
```

### Task 15: Prepare public discovery assets and beta release

**Files:**
- Modify: `README.md`
- Create: `README.en.md`
- Create: `CHANGELOG.md`
- Create: `docs/screenshots/`
- Create: `.github/workflows/release.yml`
- Modify: `package.json`

**Step 1: Write the release README**

The first screen must show:

- one-sentence value proposition;
- real GIF or screenshots;
- explicit compatibility table;
- one-line install command;
- one-line uninstall command;
- conversation-vs-tool isolation warning;
- link to issues and security policy.

Install command:

```sh
dsh plugin --profile web add dsh-sidecar
```

**Step 2: Finalize npm/GitHub metadata**

- Remove `private: true` only in the release commit.
- Set repository, homepage, bugs, author, files, keywords, and `publishConfig.access: public`.
- Set `publishConfig.provenance: true` and pre-release tag `next`.
- Keep exact supported Harness RC peer ranges.

**Step 3: Run the release gate**

Run:

```sh
pnpm verify
pnpm pack --dry-run
```

Expected: PASS; tarball contains only intended runtime, type, patch, license, and documentation files.

**Step 4: Publish and make it discoverable**

After explicit owner approval:

1. Create the public GitHub repository.
2. Add GitHub Topics: `dsh-plugin`, `deepseek-harness`, `conversation`, `sidecar`.
3. Push the signed/tagged `v0.1.0-beta.1` release.
4. Publish npm with provenance and the `next` tag.
5. Install the public package into a clean profile and rerun the smoke test.
6. Announce it in DeepSeek Harness GitHub Discussions and Discord with the demo and compatibility warning.

**Step 5: Commit release preparation**

```sh
git add README.md README.en.md CHANGELOG.md docs/screenshots .github/workflows/release.yml package.json
git commit -m "docs: prepare dsh-sidecar beta release"
```

## Definition of done for v0.1 beta

- A user can install the plugin with one command and restart Harness.
- A completed Assistant answer exposes a localized sidecar action.
- A sidecar can be created, prompted, closed, reopened, refreshed, and recovered after process restart.
- Parent Session id, event log, draft, and browsing position remain unchanged by the sidecar flow.
- At least two branches can coexist at one answer anchor.
- No private Harness import or DOM injection exists.
- Tool-side-effect wording matches the capability actually enforced.
- Packed-install and real-browser tests pass on the supported RC.
- GitHub Topic `dsh-plugin`, npm keywords, bilingual docs, demo media, and compatibility table are present.

## Deferred after beta

- Multiple drawers or nested sidecars.
- Summary citation back into the parent Session.
- Mobile-specific interaction redesign.
- Cross-device UI preference sync.
- General-purpose Session graph.
- File or Git worktree isolation.
- Support for additional Harness RCs before each one passes the full packed-install matrix.
