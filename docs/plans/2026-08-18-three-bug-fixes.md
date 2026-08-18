# Sidecar 三项缺陷修复实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use coding-agent to implement this plan task-by-task.

**Goal:** 以三个互相独立的最小中文提交，修复推理泄露、选区追问不精确和打开侧栏即产生冗余子会话的问题。

**Architecture:** 保持 Harness 0.1.0-rc.6 的公开接口边界。先在纯投影/控制器层用轻量 Vitest 测试复现每个问题，再只修改对应的数据投影、选区捕获或分支创建时机；每项修复通过相关测试后单独提交。

**Tech Stack:** TypeScript、React 18、Vitest、DeepSeek Harness 0.1.0-rc.6 公共客户端接口。

---

### Task 1: 隐藏推理事件

**Files:**
- Modify: `src/client/controllers/transcript.ts`
- Test: `tests/transcript.spec.ts`

1. 添加同时含 `reasoning-delta` 和 `text-delta` 的失败测试，断言可见转录仅含最终回答文本。
2. 单独运行 `pnpm test -- tests/transcript.spec.ts`，确认测试因推理文本泄露失败。
3. 将流式可见投影限制为 `text-delta`，不先渲染再替换。
4. 重新运行相关测试、类型检查和构建。
5. 以中文提交 Bug 1。

### Task 2: 精确捕获当前 Assistant 回答选区

**Files:**
- Modify: `src/client/controllers/selection.ts`
- Modify: `src/client/components/SidecarAction.tsx`
- Test: `tests/selection.spec.ts`
- Test: `tests/sidecar-action.spec.tsx`

1. 添加轻量 DOM 测试，覆盖跨消息选区、页面外选区、标点/换行/代码原样保留、焦点变化后仍使用按下时快照，以及无有效选区时回退整条回答。
2. 单独运行上述两个测试文件，记录失败以定位边界节点和选区读取时机。
3. 只从当前动作所属 Assistant 回答内容节点读取 `Range`，在指针按下时保存原始文本，不做 `trim()` 改写。
4. 验证打开参数仍使用回答结束序号，保证 child Session 继承完整上文。
5. 运行相关测试、类型检查和构建后，以中文提交 Bug 2。

### Task 3: 打开侧栏不立即复制会话

**Files:**
- Modify: `src/client/controllers/fork-controller.ts`
- Modify: `src/client/controllers/sidecar-controller.ts`
- Modify: `src/client/components/SidecarDrawer.tsx`
- Test: `tests/fork-controller.spec.ts`
- Test: `tests/sidecar-controller.spec.ts`
- Test: `tests/sidecar-drawer.spec.tsx`

1. 添加轻量控制器测试，断言仅打开侧栏不会调用 `sessions.fork`，首次实际追问时才创建一个 child Session，后续追问复用它。
2. 运行相关测试确认当前行为会在打开阶段立即创建子会话。
3. 将新分支创建延迟到首次提交追问；已有分支仍按原行为恢复，且同一侧栏不重复创建。
4. 运行相关测试、完整测试、类型检查和构建。
5. 以中文提交 Bug 3，并确认工作树只包含预期提交。
