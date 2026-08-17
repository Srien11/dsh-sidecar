# Security Policy

## Supported versions

项目尚未发布，因此目前没有受支持版本。

## Design boundary

第一版 sidecar 分支定位为追问用途，并计划默认使用只读能力集合。任何可能写文件、执行可变命令、发送消息或触发外部副作用的能力，都必须由用户显式升级后启用。

请勿在公开 Issue 中提交 API Key、Session 日志、工作区文件内容或其他敏感信息。安全问题发布后将提供私密报告渠道。

