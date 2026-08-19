# 侧边回答 Markdown 输出优化 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让侧边追问中的 Assistant 回答像 Harness 原生回答一样渲染 Markdown，而不是暴露 `##`、```、`**` 等源标记。

**Architecture:** 复用 `@deepseek-ai/dsh-client-ui-primitives` 已提供的安全、流式 `MarkdownText`，仅对 Assistant 消息启用；用户、工具和错误消息继续按纯文本显示。使用侧边栏自己的作用域类调整标题、段落、列表、代码、表格和引用间距，避免影响 Harness 主界面。

**Tech Stack:** React 18、TypeScript、Harness `MarkdownText`、Vitest、Testing Library

---

### Task 1: 锁定 Markdown 语义渲染

**Files:**
- Modify: `tests/child-projection-surface.spec.tsx`
- Modify: `src/client/components/ChildProjectionSurface.tsx`
- Modify: `vitest.config.ts`

**Step 1: Write the failing test**

- 构造包含二级标题、粗体、列表、行内代码和围栏代码块的 Assistant 回答。
- 断言输出为 `h2`、`strong`、`ul/li`、`code`、`pre`，而不是可见的 Markdown 源标记。
- 保留用户消息为纯文本，避免用户输入被当成富文本执行。

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/child-projection-surface.spec.tsx`

Expected: FAIL，因为当前 `<p>{message.text}</p>` 只输出纯文本。

**Step 3: Implement the minimal renderer swap**

- 从 Harness UI primitives 导入 `MarkdownText`。
- Assistant 消息渲染 `<MarkdownText text={message.text} streaming={message.pending} />`。
- 其他角色继续使用纯文本 `<p>`。

**Step 4: Run the focused test**

Run: `pnpm vitest run tests/child-projection-surface.spec.tsx`

Expected: PASS。

### Task 2: 对齐原生阅读排版

**Files:**
- Modify: `src/client/styles.ts`
- Modify: `tests/styles.spec.ts`

**Step 1: Add failing style-contract assertions**

- 断言存在侧边栏作用域 Markdown 类。
- 断言标题、列表、行内代码、代码块、引用和表格具备明确样式。
- 断言旧的 Assistant `white-space: pre-wrap` 纯文本规则不再承担 Markdown 排版。

**Step 2: Add scoped semantic styles**

- 使用 Harness 主题变量。
- 标题建立层级，段落与列表保持紧凑行距。
- 代码块横向滚动，行内代码带轻背景，表格可横向滚动。
- 添加键盘焦点和窄屏溢出保护。

**Step 3: Run style and component tests**

Run: `pnpm vitest run tests/styles.spec.ts tests/child-projection-surface.spec.tsx`

Expected: PASS。

### Task 3: 完整验证与交付

**Files:**
- Verify: `src/client/components/ChildProjectionSurface.tsx`
- Verify: `src/client/styles.ts`

**Step 1: Run verification**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm build`

Run: `pnpm check:bundle`

Expected: 全部通过。

**Step 2: Commit atomically**

```bash
git add src/client/components/ChildProjectionSurface.tsx src/client/styles.ts tests/child-projection-surface.spec.tsx tests/styles.spec.ts docs/plans/2026-08-19-sidecar-markdown-output.md
git commit -m "优化侧边回答 Markdown 渲染"
```
