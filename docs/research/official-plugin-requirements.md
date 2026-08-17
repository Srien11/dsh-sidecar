# DeepSeek Harness 官方插件要求与曝光方式

核对日期：2026-08-17。

## 结论摘要

DeepSeek Harness 当前没有需要审核后上架的官方中心商店。`dsh plugin` 本质上在用户 profile 目录中转发 pnpm 命令，然后识别安装包的 `dsh.bundle` 声明并加入 profile layer。官方明确建议插件仓库添加 GitHub Topic `dsh-plugin`；因此公开可发现性的主路径是 GitHub Topic、npm 包元数据以及官方社区公告。

Harness 仍处于 developer preview，官方明确警告会有破坏性兼容变更。外部插件必须锁定经过验证的 RC 版本并建立真实安装冒烟测试。

## 官方打包要求

### 1. Cordis 插件入口

最常见的 Cordis 插件导出命名 `apply(ctx)` 函数，可选导出 `name`。插件不能依赖配置文件中的排列顺序；服务依赖要通过 `inject` 表达。

来源：[编写第一个插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.zh.md)

### 2. Profile bundle 声明

可由 `dsh plugin` 自动激活的 npm 包必须在 `package.json` 声明：

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

包还需要导出并发布 `cordis.patch.yml`。CLI 会根据已安装依赖是否存在 `dsh.bundle.patch` 决定是否把它加入 profile bundle 列表。

来源：[官方 CLI plugin 实现](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/src/plugin.ts)

### 3. Web Client bundle 声明

带浏览器 UI 的插件需要：

- 在 `exports["./client"]` 导出构建后的浏览器 bundle。
- 在 `dsh.client` 声明 `platform: "web"`。
- 用 `dsh.client.inject` 列出需要等待的客户端包边。
- Host/Node 入口与 Client bundle 分开构建。

示意：

```json
{
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./cordis.patch.yml": "./cordis.patch.yml"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-slots"
      ]
    }
  }
}
```

来源：[Client 模块](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.zh.md)

### 4. UI slot 生命周期

外部 UI 插件应先调用 `slots.inject(slotName, callback)` 等待 slot 被声明，再在回调中 `slots.register(...)`。不能猜测 slot 的协议、id、props 或 scope，也不应替换高层根 slot。所有注册和外部订阅必须在插件卸载时清理。

来源：[官方 Cordis 插件开发技能](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/config/agent-presets/cordis/skills/cordis-plugin-development/SKILL.md)

### 5. 运行时要求

- Node.js：`^22.19.0 || >=24.0.0`
- pnpm：`11.7.0`
- 官方 master 在核对日标记 `0.1.0-rc.5`
- npm 的 `@deepseek-ai/dsh` `latest`/`next` 为 `0.1.0-rc.6`
- 相关 client 包需要使用 `next` 标签取得 `0.1.0-rc.6`

首个公开版本应将 peer dependency 限定在实际测试过的 RC，不使用宽泛范围。

## 用户安装方式

推荐 README 展示显式 profile 命令：

```sh
dsh plugin --profile web add dsh-sidecar
```

本地开发安装：

```sh
dsh plugin --profile web add link:.
```

`dsh plugin` 会在 profile 目录运行 pnpm；Git 依赖的 `prepare` 构建脚本可能被 pnpm 的构建许可策略阻止，因此 npm 应发布已经构建好的 `lib/`，不要要求最终用户安装时编译源码。

## 怎样让别人看到

### 官方明确路径

1. 创建公开 GitHub 仓库。
2. 为仓库添加 Topic：`dsh-plugin`。
3. 发布公开 npm 包，并在 `keywords` 同时包含 `dsh-plugin`、`dsh`、`deepseek-harness`。
4. README 提供一行安装命令、兼容版本表、截图或 GIF、权限/副作用说明。
5. 发布 GitHub Release，并在官方 GitHub Discussions 或 Discord 社区分享。

官方入口依据：[DeepSeek Harness README](https://github.com/deepseek-ai/deepseek-harness#community-and-support)

### 建议但非官方审核要求

- 中英文 README。
- npm provenance。
- GitHub Actions 测试与发布工作流。
- `SECURITY.md`、`CONTRIBUTING.md`、MIT License。
- 可验证的真实 Harness 安装与 Chromium 冒烟测试。
- 提交到社区插件目录，但这些目录不代表 DeepSeek 官方认证。

## 与本项目直接相关的官方限制

Client Runtime 文档注明当前 staged session 只能有一个占用者，并把并发 pane 作为未来落地方向。这是 `dsh-sidecar` 的首要技术风险：不能先假设在一个页面里可同时运行两个原生 Session surface。

来源：[Client Runtime README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/runtime/README.zh.md#已知限制与暂缓事项)

因此公开发布前必须完成 Phase 0 技术验证，并只选择公共、可测试、可卸载的接入方式。
