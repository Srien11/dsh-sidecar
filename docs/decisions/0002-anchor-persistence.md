# ADR 0002：分支锚点恢复

状态：Accepted
日期：2026-08-17

## 决定

不向 parent 或 child Session 写入插件自定义事件，也不为 Beta 增加独立 profile 数据库。
锚点由 Harness 已持久化的 lineage 和历史记录冷启动推导：读取 child 的 `parentSessionId`，
比较 parent 与 child 的最长相同事件前缀，并选择该前缀中最后一个 `turn/end`。

用户刚创建分支时仍把精确 `{ parentSessionId, turnEndSeq, seedLength }` 交给 repository 校验；
它必须与持久血缘一致。页面关闭、插件卸载或重启后，可以只从普通 Harness Session 重建。

## 原因

- `session.fork` 的 child 会保留分叉点之前的完整事件前缀。
- parent 和 child 后续事件在首个不同 seq 处分开，因此 parent 后来继续对话也不会改变共同前缀。
- 选择共同前缀中的最后一个 `turn/end`，可以排除半个回合和工具执行中的不完整边界。
- 卸载插件后没有孤立元数据；child 仍是普通可读 Session。

## 失败策略

缺失 parent、没有共同 completed-turn boundary、历史不连续或 lineage 不匹配时返回“不可恢复”，
不猜测锚点。若未来 Harness 直接公开 fork anchor 元数据，应优先使用官方字段并保留此算法作为兼容读取器。
