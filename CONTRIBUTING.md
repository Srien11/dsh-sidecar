# Contributing

项目仍处于技术验证阶段。提交代码前请先阅读：

1. `docs/research/official-plugin-requirements.md`
2. `docs/decisions/0001-concurrent-session-surface.md`
3. `docs/plans/2026-08-17-dsh-sidecar.md`

基本约定：

- 只使用当前已验证的 DeepSeek Harness 公共 API 与公共 UI slot。
- 不通过 DOM 查询、私有字段或未导出路径接入核心界面。
- 所有 Session、事件和 UI 状态边界都要有测试。
- 新行为先写失败测试，再实现最小功能。
- 每个提交只完成一个可独立验证的小目标。
- 兼容性范围必须写成精确 RC 版本，不使用宽泛的 `*` 或 `latest`。

