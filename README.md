# dsh-sidecar

在不离开 DeepSeek Harness 主对话的情况下，从某条已完成回答打开一个可持续追问、自动保存、随时恢复的侧边对话。

> 当前状态：`0.1.0-beta.0`，已完成可运行 MVP，并通过 `@deepseek-ai/dsh@0.1.0-rc.6` 的真实安装与浏览器冒烟测试。Harness 仍处于预览期，后续 RC 可能带来破坏性变化。

## 已实现

- 在已完成的 Assistant 回答旁显示“追问”按钮和已有分支数量。
- 从该回答结束边界 fork 官方 Session，不切换当前主会话。
- 在右侧抽屉显示 child 新增历史，继承内容不会重复显示。
- 直接向 child 发送追问、查看流式回答、工具摘要和回合错误。
- 关闭按钮或 `Escape` 只收起抽屉，不删除 child；再次点击可恢复原问答。
- 冷启动后从 Harness 的 `parentId`、`seedLength` 和历史共同前缀重建锚点，无需插件私有数据库。
- 插件卸载时清理 slot、轮询和样式节点。

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

1. 打开包含已完成 AI 回答的会话。
2. 点击回答尾部的“追问”。
3. 在右侧抽屉继续提问；按 `Enter` 发送，按 `Shift+Enter` 换行。主会话保持选中且不会被追加消息。
4. 点击关闭按钮或按 `Escape` 收起，之后从同一回答再次打开。

## 隔离边界

本插件保证的是对话记录隔离：追问和回答只进入 child Session，不会自动写回、截断、重命名或归档 parent Session。

工具副作用不隔离。child 与 parent 仍可能使用相同工作区、文件系统和外部服务；如果 child 获准调用写入型工具，这些效果对主工作区同样可见。请使用 Harness 权限模式控制工具访问。

## 实现方式

插件只使用 Harness `0.1.0-rc.6` 的公开接口：

- `sessions.fork` 创建持久 child；
- `sessions.history` 投影 child 历史；
- `sessions.prompt` 和 `sessions.cancel` 驱动 child；
- `conversation.chat.assistant-actions` 注入回答操作；
- `shell.overlay` 承载抽屉。

当前 Client Runtime 一次只能 stage 一个原生 Session surface，因此抽屉使用轻量历史投影，不挂载第二个原生 Conversation surface，也不切换 `sessions.current`。

## 开发验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm pack --dry-run
```

当前测试覆盖分支索引、冷启动锚点恢复、fork 原子性、回答操作边界和 child transcript 投影。

## 文档

- [官方插件要求与曝光方式](docs/research/official-plugin-requirements.md)
- [产品规格](docs/product-spec.md)
- [并发 Session 技术决策](docs/decisions/0001-concurrent-session-surface.md)
- [锚点持久化技术决策](docs/decisions/0002-anchor-persistence.md)
- [真实双 Session 验证结果](docs/research/dual-session-spike-results.md)
- [详细实施计划（English）](docs/plans/2026-08-17-dsh-sidecar.md)
- [详细实施计划（中文）](docs/plans/2026-08-17-dsh-sidecar.zh.md)

## 许可证

[MIT](LICENSE)
