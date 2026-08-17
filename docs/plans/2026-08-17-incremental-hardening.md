# Sidecar 精确追问与增量加固实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use coding-agent to implement this plan task-by-task.

**Goal:** 先支持只引用当前 Assistant 回答中的精确选区发起追问，再把已发现的安全性、正确性、性能和产品完整性问题逐项以最小提交修复。

**Architecture:** 保持“官方 child Session + 非 staged 侧栏投影”的现有架构。每项改动只扩展一个公开契约或修复一个状态边界；每项先添加可复现测试，再做最小实现，验证后独立提交。

**Tech Stack:** TypeScript、React 18、Vitest、Testing Library、DeepSeek Harness `0.1.0-rc.6` public client contracts。

---

### Task 1: 精确选区追问

**Files:**
- Create: `src/client/controllers/selection.ts`
- Modify: `src/client/components/SidecarAction.tsx`
- Modify: `src/client/controllers/sidecar-controller.ts`
- Modify: `src/client/components/SidecarDrawer.tsx`
- Modify: `src/client/components/ChildProjectionSurface.tsx`
- Test: `tests/selection.spec.ts`
- Test: `tests/sidecar-action.spec.tsx`
- Test: `tests/child-projection-surface.spec.tsx`

**Steps:**
1. 写失败测试：仅接受当前 `[data-turn-tail]` 内的非空选区，拒绝其他回答或页面区域的选区。
2. 写失败测试：点击“追问”把精确选区传入 controller。
3. 写失败测试：抽屉显示选区，输入框预填引用块；fork 边界仍为完整 `turn/end`，保证 child 继承全部上文。
4. 实现最小选区提取和状态传递。
5. 运行相关测试、类型检查和完整测试。
6. Commit: `功能：支持选中文本发起侧边追问`。

### Task 2: 安全错误投影

**Files:**
- Modify: `src/client/controllers/transcript.ts`
- Test: `tests/transcript.spec.ts`

**Steps:**
1. 写失败测试：AUTH 错误不展示 provider 原始消息或疑似凭据。
2. 按错误码投影稳定、安全的用户文案，保留非敏感错误的可诊断信息。
3. 运行 transcript 测试和完整测试。
4. Commit: `安全：隐藏认证错误中的原始诊断`。

### Task 3: 防止过期打开操作覆盖界面

**Files:**
- Modify: `src/client/controllers/sidecar-controller.ts`
- Create: `tests/sidecar-controller.spec.ts`

**Steps:**
1. 写失败测试：A 后 B 的完成顺序不能让 A 覆盖 B。
2. 写失败测试：打开过程中关闭后，迟到结果不能重新打开抽屉。
3. 添加单调 intent epoch，只允许最新操作发布状态。
4. 运行相关测试和完整测试。
5. Commit: `修复：忽略过期的侧栏打开结果`。

### Task 4: 轮询单飞与空闲退避

**Files:**
- Modify: `src/client/components/ChildProjectionSurface.tsx`
- Test: `tests/child-projection-surface.spec.tsx`

**Steps:**
1. 写失败测试：慢 history 请求期间不会启动第二个请求。
2. 写失败测试：切换 child 或卸载后，旧响应不能更新当前消息。
3. 将固定 interval 改为请求完成后再安排下一次；running 使用短间隔，idle 使用长间隔。
4. 运行相关测试和完整测试。
5. Commit: `性能：让侧栏历史轮询单飞并退避`。

### Task 5: 缓存分支锚点，消除按钮级全历史扫描

**Files:**
- Modify: `src/client/controllers/sidecar-controller.ts`
- Modify: `src/host/derived-anchor-repository.ts`
- Test: `tests/sidecar-controller.spec.ts`
- Test: `tests/anchor-repository.spec.ts`

**Steps:**
1. 写失败测试：同一 child 的不可变 anchor 只推导一次，并复用 parent history 请求。
2. 在 controller/repository 层增加 promise cache，失败项可重试，成功项长期复用。
3. 运行相关测试和完整测试。
4. Commit: `性能：缓存不可变的分支锚点`。

### Task 6: 显示 child 的待处理交互

**Files:**
- Modify: `src/client/components/SidecarDrawer.tsx`
- Test: `tests/sidecar-drawer.spec.tsx`

**Steps:**
1. 写失败测试：`approval`、`question`、`plan-review` 显示明确阻塞提示。
2. 提供显式“打开子会话处理”操作；不自动切换主会话。
3. 运行相关测试和完整测试。
4. Commit: `功能：提示侧边会话的待处理交互`。

### Task 7: 通过 SessionFace 驱动 prompt/cancel

**Files:**
- Modify: `src/client/controllers/session-gateway.ts`
- Create: `tests/session-gateway.spec.ts`

**Steps:**
1. 写失败测试：优先通过 `sessions.binding(id).session` 发送和取消。
2. 对不可寻址 child 给出明确错误，不回退到底层裸 RPC。
3. 运行相关测试和完整测试。
4. Commit: `重构：通过官方 SessionFace 驱动侧边会话`。

### Task 8: 分支身份与归档边界

**Files:**
- Modify: `src/index.ts`
- Modify: `src/client/index.ts`
- Modify: `src/client/controllers/sidecar-controller.ts`
- Add host-side index files and focused tests as required by the inspected public storage contract.

**Steps:**
1. 先核对当前 profile 暴露的官方 Host storage/service 契约。
2. 写失败测试：普通 Harness fork 不能被当作 sidecar；归档 sidecar 不参与默认计数和恢复。
3. 用官方持久存储记录最小 `childId -> anchor` 元数据；保留历史推导作为旧版本迁移入口。
4. 运行安装、冷启动和完整测试。
5. Commit: `修复：区分侧边分支与普通会话分支`。

### Task 9: 产品表层收尾

**Files:**
- Modify: Sidecar React components, styles, locale registration, README and product spec.
- Add focused component tests and browser smoke checks.

**Steps:**
1. 分别实现分支选择、重命名/归档、焦点恢复、中英文 locale、主题 token；每个能力单独测试并单独提交。
2. README 区分“已实现”和“规划中”，与真实能力保持一致。
3. 最终运行 typecheck、完整测试、build、bundle check、pack dry-run 和真实 Harness 浏览器冒烟。

