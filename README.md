# dsh-sidecar

[简体中文](README.md) | [English](README.en.md)

为 DeepSeek Harness 带来类似 Codex 的侧边上下文追问体验：选中 AI 回答中的任意片段，即可在选区旁直接发起追问；如果没有选区，也可以从回答末尾针对整条内容继续提问。

每次新追问都在独立、持久化的 child Session 中进行。已完成回答通过原生分叉继承上下文；仍在输出的回答会冻结点击那一刻的可见历史，并将其交给独立会话，之后不再跟随主对话变化。两种方式都不会跳转或污染主对话。

回答末尾的“已有追问”入口直接显示每个追问的摘要（该追问的首个问题），不用再从“追问 1 / 追问 2”里猜；段中被追问过的原文保持黄色高亮，点击就能回到那次追问；追问窗口是一个可自由拖动、八向缩放、能记住上次位置的浮动窗口，不会再压住正在读的原文。

## 它能解决什么

- **不中断主线**：验证细节、解释代码或探索替代方案时，主对话保持原样。
- **精确追问**：准确保留选中文字中的标点、换行和代码，避免重新复制粘贴。
- **独立追问**：侧边对话自动保存，同一回答可维护多个互不混放的追问方向。
- **看摘要而不是编号**：回答末尾的追问列表显示每个追问的首个问题摘要，选中项还会高亮显示当前追问。
- **原文就是入口**：段中被追问过的文字保持黄色高亮，点击高亮（或聚焦后按 `Enter`/`Space`）即恢复那次追问，重复出现的同一段文字也会各自对号入座。
- **不挡住原文**：追问窗口可拖动、可缩放、可一键复位，并记住上次的窗口位置与大小。
- **原生融合**：跟随 Harness 的中英文界面和明暗主题，并沿用原有权限边界。

`选中回答片段 → 点击选区旁“追问” → 在浮动窗口里继续对话 → 关闭后可随时从原文高亮或段尾摘要恢复`

> 当前状态：`0.1.0-beta.0`，面向 `@deepseek-ai/dsh@0.1.0-rc.6`。核心运行路径曾通过真实安装与浏览器冒烟；当前自动化回归包含 163 项测试，并通过类型检查、构建和 Bundle（产物包）契约验证。Harness 仍处于预览期，后续 RC 可能带来破坏性变化。

## 已实现

- 选中当前 Assistant 回答中的文字后，立即在选区旁显示浮动“追问”按钮；回答末尾保留整条追问入口，并直接列出每个追问的摘要。
- 由选区创建的追问会在原文处保留黄色高亮：悬停或聚焦显示“打开追问：摘要”，点击或按 `Enter`/`Space` 即恢复该追问；创建时记录的字符偏移让重复文字也能定位到当时选中的那一处。
- 追问窗口是可拖动的浮动框：标题栏任意位置都能拖动窗口（左侧抓手同时是键盘入口），四条边和四个角都可缩放，标题栏“复位”恢复默认位置；聚焦抓手后方向键移动、`Shift`+方向键缩放，窗口位置和大小保存在浏览器本地存储中。
- 主回答仍在生成且已有可见文字时，输入框旁显示“追问当前输出”；无需等待主回答完成。
- 只接受当前回答内部的有效选区，并精确保留标点、换行和代码；选区固定显示在抽屉顶部并随追问保存，但不会预填输入框或混入消息回放。
- 打开侧栏时不创建 Session；首次发送时才创建 child，并立即从普通对话列表隐藏，不切换当前主会话。已完成回答从结束边界 fork；未完成回答创建独立空白 Session，只注入点击时冻结的可见历史。
- 每次点击“追问”都新建一个独立追问；同一回答的历史追问通过回答旁的“已有追问”入口分别恢复。
- 可重命名当前追问；归档前需要二次确认。
- 在窗口内显示 child 新增历史，继承内容不会重复显示。
- 发送后立即显示“AI 正在回复…”，活动回合以 250ms 频率近实时刷新增量回答，并显示工具摘要和回合错误。
- child 等待审批、回答或计划确认时给出提示，可显式打开原生子会话处理。
- 关闭按钮或 `Escape` 只收起窗口，不删除 child；再次点击可恢复原问答。
- 打开时聚焦侧栏输入框，关闭后把焦点还给原“追问”按钮或原文高亮。
- 跟随 Harness 的中文/英文语言设置和明暗主题 token。
- 通过官方 `storageDomain` 持久保存最小 `childId -> anchor` 记录（含首个问题摘要、选中片段及其字符偏移）；普通 Harness fork 不会被误认成 sidecar。
- 系统隐藏的 sidecar 仍参与按钮计数和恢复；用户主动归档后才退出索引。
- 插件卸载时清理 slot、轮询、高亮和样式节点。

## 安装

当前 Beta 尚未发布到 npm。源码安装需要 Node.js `^22.19.0 || >=24.0.0`、pnpm `11.7.0` 和 DeepSeek Harness `0.1.0-rc.6`：

```powershell
git clone https://github.com/Srien11/dsh-sidecar.git
cd dsh-sidecar
pnpm install
pnpm build
dsh plugin --profile web add link:D:\absolute\path\to\dsh-sidecar
```

安装后重启 Web profile。npm 发布后，安装命令将简化为：

```sh
dsh plugin --profile web add dsh-sidecar
```

## 使用

1. 打开正在生成或已经包含 AI 回答的会话。
2. 回答仍在生成时，点击输入框旁的“追问当前输出”，窗口会固定使用点击这一刻的可见历史。
3. 回答完成后，如需针对具体片段，选中文字并点击选区旁立即出现的“追问”；也可点击回答尾部的“追问”。
4. 补充问题后按 `Enter` 发送，按 `Shift+Enter` 换行。主会话保持选中且不会被追加消息。
5. 拖动窗口标题栏任意位置把窗口移开原文，拖边框或右下角改变大小，点“复位”回到默认位置；位置和大小会被记住。
6. 回答尾部的下拉框按摘要列出该回答的所有追问，选中项会高亮；被追问过的原文保持黄色高亮，点击高亮即可回到对应追问。
7. 可在窗口顶部重命名或归档当前追问。
8. 点击关闭按钮或按 `Escape` 收起，之后从原文高亮、段尾摘要或同一回答的入口再次打开。

## 隔离边界

本插件保证的是对话记录隔离：追问和回答只进入隐藏的 child Session，不出现在普通对话列表，也不会自动写回、截断、重命名或归档 parent Session。

工具副作用不隔离。child 与 parent 仍可能使用相同工作区、文件系统和外部服务；如果 child 获准调用写入型工具，这些效果对主工作区同样可见。请使用 Harness 权限模式控制工具访问。

## 实现方式

插件只使用 Harness `0.1.0-rc.6` 的公开接口：

- `sessions.fork` 创建持久 child；
- `workspaces.connectWorkspace` 为未完成回答创建同工作区的独立空白 child；
- `sessions.history` 投影 child 历史；
- `SessionFace.prompt`、`cancel` 和 `rename` 驱动 child；
- `workspaces.archiveSession` 将 child 从普通会话分组中隐藏；
- `storageDomain` 和插件 RPC 通道持久化、读取分支锚点（含首个问题摘要、选中片段及其字符偏移）；
- `conversation.chat.assistant-actions` 注入回答操作、段尾摘要列表与段内高亮入口；
- `conversation.input.right` 注入流式回答期间的即时追问入口；
- `shell.overlay` 承载可拖动的浮动窗口。

当前 Client Runtime 一次只能 stage 一个原生 Session surface，因此窗口内使用轻量历史投影，不挂载第二个原生 Conversation surface，也不切换 `sessions.current`。主对话使用原生实时事件窗口；侧边 child 受公开接口限制，通过活动回合 250ms 轮询提供近实时增量输出。

## 开发验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm pack --dry-run
```

当前 163 项测试覆盖锚点存储/RPC、sidecar 身份与归档边界、fork 原子性、流式历史冻结、即时精确选区与选区字符偏移、段落内高亮与点击入口（含重复文字定位、跨段落跳过、清理还原）、追问摘要列表与回退标签、浮动窗口几何（拖动/缩放/键盘/越界收敛/持久化）、独立追问恢复、活动回合刷新、焦点、双语词典、主题契约和 child transcript 投影。

上述命令只复用现有 `node_modules`。完整 Harness 安装与浏览器冒烟属于发布前的独立验收，不作为日常本地回归步骤。

## 文档

- [官方插件要求与曝光方式](docs/research/official-plugin-requirements.md)
- [产品规格](docs/product-spec.md)
- [并发 Session 技术决策](docs/decisions/0001-concurrent-session-surface.md)
- [锚点持久化技术决策](docs/decisions/0002-anchor-persistence.md)
- [真实双 Session 验证结果](docs/research/dual-session-spike-results.md)
- [详细实施计划（English）](docs/plans/2026-08-17-dsh-sidecar.md)
- [详细实施计划（中文）](docs/plans/2026-08-17-dsh-sidecar.zh.md)
- [追问摘要、段内高亮与浮动窗口实施计划](docs/plans/2026-08-31-follow-up-summary-and-floating-window.zh.md)

## 许可证

[MIT](LICENSE)
