# ADR 0001：并发 Session Surface 策略

状态：Accepted
日期：2026-08-17

## 背景

产品要求主对话保持可见且不跳转，同时在右侧运行和保存一个 child Session。官方 Client Runtime 当前只支持一个 staged Session 占用者；普通外部插件不能假设可以挂载第二个完整 Conversation surface。

## 决策门槛

实现开始前执行一个真实 `0.1.0-rc.6` 技术 spike，回答：

1. 公共 Client API 能否为非 current Session 建立可订阅的事件窗口？
2. 公共 slot/scope API 能否把严格 session provider 绑定到显式 `sessionId`？
3. child Session 能否在不改变 `sessions.current` 的前提下接收 prompt？
4. 第二个 surface 能否正确处理 streaming、tool card、取消和重连？
5. 插件卸载后能否完全释放第二个订阅与 UI？

只有五项全部通过，才采用路线 A。

## 候选路线

### 路线 A：公共 API 的原生双 Session surface（首选）

使用官方 `sessions.fork` 创建 child，以显式 session binding 驱动右侧 surface，不改变主 Session selection。

优点：复用原生持久化、流式事件、工具卡和错误恢复。  
缺点：当前文档暗示尚不支持，必须以实际公共接口验证为准。

### 路线 B：独立同源页面嵌入抽屉（次选）

在抽屉中嵌入一个独立 DSH 页面/窗口实例，让两个页面分别拥有一个 current Session，通过受限消息桥传递 child id 和关闭事件。

采用条件：官方路由能精确打开 session、CSP 允许同源嵌入、认证与连接不会产生不安全共享、可访问性可接受。

优点：不修改单页面 session scope。  
缺点：启动较重、焦点和尺寸复杂、可能被 CSP 或路由能力阻断。

### 路线 C：冻结主视图，暂时把原生 current 切到 child（降级方案）

打开抽屉前缓存父对话的只读 snapshot、滚动位置和草稿；页面运行时切换到 child，左侧展示冻结的父 transcript。关闭时重新打开父 Session 并恢复 UI 状态。

采用条件：公开 API 能稳定恢复父 Session，且产品接受 sidecar 打开期间父对话只读。

优点：仍复用原生 child runtime。  
缺点：不是严格的双 Session 并发，主对话实时状态会被冻结。

### 路线 D：插件自有对话运行时（不建议）

插件直接调用 LLM 并自行持久化消息，只在适当时转换成 Session。

拒绝理由：重复实现 agent loop、工具策略、持久化和恢复，卸载后数据可读性差，也偏离“一切复用官方 fork”的初衷。

### 路线 A2：公共 Session API + 自定义 child 投影（已选择）

使用 `sessions.fork` 创建 child Session，并用 `workspaces.archiveSession` 将其从普通会话分组隐藏；通过公开 `ctx.connection.api.sessions.history` 轮询任意 child，
通过 `prompt` 和 `cancel` 驱动它。插件只折叠并展示消息、状态和错误，不实现自己的 LLM/agent loop，
也不改变 `sessions.current`。

优点：主 Session 始终保持 current 和可见；child 使用 Harness 原生日志与持久化；关闭 UI 只释放轮询。
缺点：不是原生第二 Conversation surface；流式显示有轮询延迟，复杂工具卡在 Beta 中只能降级展示。

## 决定

选择路线 A2。真实 `0.1.0-rc.6` 验证表明非 current child 可以 fork、prompt、history 和 cancel，
而 parent selection 与日志保持不变；但 published Client Runtime 明确只为 `list.current` stage 一个事件窗口，
所以路线 A 的原生双 surface 不成立。

路线 B 暂不采用：它会启动第二套完整页面运行时，成本和焦点管理明显高于 A2，而 A2 已满足“追问不污染主线”。
路线 C 暂不采用：它需要切换 current，弱于已验证的 A2。路线 D 仍拒绝，因为 A2 复用官方 Session 和 agent loop，
无需插件自建对话后端。

Beta 能力边界：文本消息、运行/错误状态、发送、取消、关闭后保存与重新打开是承诺功能；原生工具卡等价呈现、
零延迟 streaming 和强制只读工具策略不是 Beta 承诺。任何实现仍不得依赖未导出的内部模块、DOM 猜测或 monkey patch。
