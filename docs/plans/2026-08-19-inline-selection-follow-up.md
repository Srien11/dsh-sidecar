# 选区旁即时追问 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在当前 Assistant 回答内选中文字后，直接在选区附近显示“追问”入口，并以精确选区打开侧边追问。

**Architecture:** 复用每条回答段尾 `SidecarAction` 已有的回答边界和 child Session 上下文参数。选区控制器严格验证选区两端属于该 action 对应的 Assistant 回答，并返回原始文本与视口坐标；组件通过 portal 在 `document.body` 渲染固定定位按钮，按下时缓存文本，避免焦点变化丢失选区。

**Tech Stack:** React 18、TypeScript、React DOM portal、Vitest、Testing Library、Harness 0.1.0-rc.6 插槽。

---

### Task 1: 选区快照

**Files:**
- Modify: `src/client/controllers/selection.ts`
- Test: `tests/selection.spec.ts`

**Step 1: Write the failing test**

补充测试，断言合法选区返回未裁剪文本和 Range 的视口矩形；矩形无效时退化到最后一个非零 client rect；跨回答与页面选区仍被拒绝。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run tests/selection.spec.ts`

Expected: FAIL，原因是 `selectionSnapshotWithin` 尚未导出。

**Step 3: Write minimal implementation**

抽取 action 对应 Assistant 回答的查找函数，新增 `selectionSnapshotWithin`，保留 `selectionTextWithin` 兼容包装。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run tests/selection.spec.ts`

Expected: PASS。

### Task 2: 选区旁浮动入口

**Files:**
- Modify: `src/client/components/SidecarAction.tsx`
- Modify: `src/client/styles.ts`
- Test: `tests/sidecar-action.spec.tsx`

**Step 1: Write the failing test**

补充测试，断言当前回答形成选区后出现“追问选中内容”，点击使用精确文本和原回答结束边界；按下后即使浏览器清空 Selection 仍保持文本；页面其他区域选区不显示入口。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run tests/sidecar-action.spec.tsx`

Expected: FAIL，原因是浮动入口尚未渲染。

**Step 3: Write minimal implementation**

监听 `selectionchange`、`pointerup` 与 `keyup`，用 `requestAnimationFrame` 合并刷新；通过 portal 渲染固定定位按钮；段尾按钮与浮动按钮共用同一打开函数。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run tests/selection.spec.ts tests/sidecar-action.spec.tsx`

Expected: PASS。

### Task 3: 完整验证与原子提交

**Files:**
- Modify: only files listed above

**Step 1: Run relevant and full tests**

运行定向测试与完整 Vitest 测试集。

**Step 2: Run static and build verification**

运行 TypeScript 类型检查、构建和 Bundle 检查。

**Step 3: Run lightweight DOM interaction verification**

用 jsdom 单元测试模拟在回答中部选中文字、选区旁按钮出现、焦点变化后点击，并确认侧栏收到精确选区和原回答上下文边界；不运行重型浏览器冒烟。

**Step 4: Commit**

```bash
git add docs/plans/2026-08-19-inline-selection-follow-up.md tests/selection.spec.ts tests/sidecar-action.spec.tsx src/client/controllers/selection.ts src/client/components/SidecarAction.tsx src/client/styles.ts
git commit -m "支持选区旁即时追问"
```
