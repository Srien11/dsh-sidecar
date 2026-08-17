# dsh-sidecar

在不离开 DeepSeek Harness 主对话的情况下，从某条已完成回答打开一个可持续追问、自动保存、随时恢复的侧边对话。

> 当前状态：规划与技术验证阶段，尚不可安装。仓库暂时设置为 `private: true`，防止误发布。

## 产品目标

- 在已完成的 Assistant 回答旁提供“侧边追问”入口。
- 右侧抽屉继承该回答之前的上下文，主对话保持可见。
- 关闭抽屉只收起界面，分支 Session 继续持久化。
- 回答旁显示已有追问数量，可随时重新打开。
- 分支不会自动写回主对话；用户可以显式复制或引用摘要。
- 第一版默认只读，避免工具副作用影响主工作区。

## 与现有分支插件的区别

DeepSeek Harness 已原生支持 Session fork，社区也已有版本树、消息编辑和分支图插件。`dsh-sidecar` 不重新实现 fork，而是聚焦“不中断主线阅读的侧边追问”这一交互：主对话留在原位，分支在抽屉中独立运行和保存。

## 当前关键技术问题

DeepSeek Harness 当前 Web Client 的 session scope 只支持一个 staged 会话占用者，官方文档把并发 pane 列为未来扩展点。实现前必须验证外部插件能否安全承载第二个 Session surface；如果不能，不能依赖私有 API 强行接入。

相关结论和备选路线见：

- [官方插件要求与曝光方式](docs/research/official-plugin-requirements.md)
- [产品规格](docs/product-spec.md)
- [并发 Session 技术决策](docs/decisions/0001-concurrent-session-surface.md)
- [详细实施计划](docs/plans/2026-08-17-dsh-sidecar.md)

## 官方依据

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [Session fork API](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/feature/2026-06-30-session-store-fork-api.zh.md)
- [Web Session fork 操作](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/feature/2026-07-27-web-session-fork-actions.zh.md)
- [Client 模块](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.zh.md)

## 许可证

[MIT](LICENSE)

