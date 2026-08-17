# Dual-Session spike results

状态：已完成
基线：DeepSeek Harness `0.1.0-rc.6`

## 环境

- 日期：2026-08-17
- Harness：`@deepseek-ai/dsh@0.1.0-rc.6`
- Node.js：`v24.19.0`
- pnpm：`11.19.0`（项目发布仍锁定计划要求的 `11.7.0`）
- 浏览器自动化：Agent Browser `0.34.0` / Chromium
- `DSH_HOME`：`D:\agent-study\dsh-sidecar\.spike\dsh-home`
- 本地地址：`http://127.0.0.1:64769`
- DeepSeek API Key：不存在

`.spike/` 已加入 `.gitignore`；该目录不提交，因为它包含本地 profile 和可能的凭据状态。

## 公共接口证据

完整签名见 `spikes/dual-session/queries.md`。关键公开契约如下：

- `ISessions.fork(...)` 创建 child，不自动调用 `open()`。
- `ISessions.binding(id)` 是无 staging 副作用的纯解析，并公开 `SessionFace.prompt(...)`。
- `ctx.connection.api.sessions.history/prompt/cancel` 可按明确的 Session id 调用。
- `conversation.chat.assistant-actions` 是公开的 session-scope list slot，组件获得 `messageId`、`sessionId` 和 `useSession`。
- `SessionRuntime.followCurrent()` 只为 `list.current` 打开实时历史窗口；当前 RC 没有第二 staged occupant。

## 现场验证

隔离 profile 中创建了 parent `session-ea02716e-5f71-4e55-89d7-421448e524ba`，完成一个以
seq 16 结束的回合；因为没有 API Key，回合以 `MISSING_CREDENTIAL` 结束，但形成了合法、可分叉的
completed-turn boundary。

从 seq 16 创建 child `session-7becbc4f-0b59-4edc-85b4-80a2cb50a1a9` 后：

- Harness 页面仍显示 parent treeitem 为 `selected`。
- child summary 的 `parentSessionId` 正确指向 parent。
- 向非 current child 发送追问得到 `{ accepted: true }`。
- parent 历史保持 17 个事件、`lastSeq: 16`，只含 parent baseline。
- child 历史增长到 27 个事件、`lastSeq: 26`，同时含继承的 baseline 和 child-only 追问。
- sidebar 在 parent 仍选中时把 child 标记为“已完成”。

这证明 fork、上下文继承、非 current prompt、独立持久化和父日志不变均可用公开 API 实现。

## Gate A 结果

| 检查 | 结果 | 证据 |
|---|---:|---|
| Fork 不改变 current selection | PASS | parent 在 fork 前后均为 selected |
| Prompt 非 current child | PASS | Host 返回 `accepted: true` |
| Parent 日志不变 | PASS | parent `lastSeq` 保持 16 |
| Child 独立持久化 | PASS | child `lastSeq` 增长到 26，且 lineage 正确 |
| 同一 runtime 的两个原生事件窗口 | FAIL | published runtime 只 stage `list.current` |
| 两个原生 Conversation surface | FAIL | `conversation.session` 绑定唯一 staged Session |

因此原 ADR 路线 A（两个原生 surface）未通过。不是产品 No-Go：公开 `ConnectionHandle.api`
允许插件在不改变 current 的前提下轮询 child history、发送 prompt 和 cancel。MVP 采用新的路线 A2：
**官方 Session + 自定义只读投影面板**。它不重写 agent loop 或持久化，只把 child 的官方事件历史折叠成
侧栏消息；流式刷新采用有界轮询，关闭面板即停止轮询，child 本身仍由 Harness 持久化。

## 尚未覆盖

- 无 API Key，未观察真实 token streaming；MVP 必须通过 fixture 和后续带 Key 的真实浏览器测试补齐。
- 未验证工具卡完全复用原生 renderer；Beta 先显示文本、运行状态和错误，工具详情提供摘要。
- 未找到 per-child 强制只读策略，文案只能声明“对话记录隔离”，不能声明“工具副作用隔离”。
