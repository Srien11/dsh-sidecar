# ADR 0002：分支锚点持久化

状态：Accepted
日期：2026-08-17

## 决定

不向 parent 或 child Session 写入插件自定义事件。Host 端通过官方 `storageDomain` 在插件命名空间中
持久保存最小 `childId -> { parentSessionId, turnEndSeq, seedLength }` 记录，Client 通过插件专用 RPC
通道读写。只有存在且通过 schema 校验的记录才代表 sidecar 身份。

历史共同前缀推导不再作为自动迁移入口。旧版本记录与普通 Harness fork 在事件历史上无法可靠区分，
自动迁移会把普通分支误认成 sidecar，因此正确性优先于无证据迁移。

## 原因

- sidecar 身份与普通 Harness fork 有明确、可验证的边界。
- 锚点记录很小，不需要扫描 parent/child 完整历史。
- `storageDomain` 由 Harness 管理持久性与插件命名空间隔离。
- 卸载插件后 child 仍是普通可读 Session；插件元数据不进入对话日志。

## 失败策略

记录缺失、schema 校验失败、parent 不匹配或边界不一致时返回“不是 sidecar”，不扫描历史猜测。
若未来 Harness 直接公开可证明来源的 fork anchor 与插件身份元数据，应优先迁移到官方字段。
