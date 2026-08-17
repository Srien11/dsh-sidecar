# dsh-sidecar 实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 构建一个可安装的 DeepSeek Harness Web 插件，让用户在不离开主对话的情况下，从某条已完成回答打开可持久化的侧边追问会话。

**架构：** 复用 Harness 原生 `session.fork` 与 Session 持久化；把不稳定的 Harness 调用封装在小型适配层中，分支索引和界面状态保持为纯领域逻辑，UI 只通过公开 Client slot 注册。由于当前 Client Runtime 文档明确指出 staged Session 只有一个占用者，必须先执行 Phase 0 技术验证并选择渲染路线；禁止依赖私有模块或 DOM 补丁。

**技术栈：** TypeScript 6.0、React 18、Cordis 4.0.1、DeepSeek Harness 0.1.0-rc.6 Client 包、tsdown 0.22、Vitest 4.1、Testing Library、Playwright 1.49、pnpm 11.7、Node.js 22.19+/24+。

---

## 可行性结论

这项任务不是“整体都已确定可行”，而是分成三层：

### 已由官方实现证明的部分

- 可以从已完成轮次创建 child Session。
- child Session 可以继承父 Session 截至分叉点的上下文。
- child Session 使用 Harness 正常持久化，关闭界面不会丢失记录。
- fork 不会改写父 Session 的事件日志。
- Web Client 支持外部 Client bundle 和 UI slot 扩展。
- 插件可以通过 `dsh plugin --profile web add <package>` 安装。

因此，“独立追问、上下文继承、保存和重新打开”本身是确定可行的。

### 有条件可行的部分

- 在右侧显示抽屉壳、分支列表、关闭和恢复状态是可行的。
- 让主对话看起来保持原位置也有多种实现路线。
- 但能否在同一 Web 页面里同时运行两个完整原生 Session surface，必须以真实公共 API 验证。

### 尚未证明的部分

- 主 Session 与 child Session 同时保持完整交互、流式输出、工具卡、取消和重连。
- 在不修改 Harness 核心的情况下，为 child 强制配置完全只读的工具集合。
- 通过纯外部插件获得与未来官方并发 pane 完全相同的体验。

### 最低可交付边界

如果原生双 Session 路线失败，但“冻结主对话显示、保持滚动位置和草稿，右侧运行 child，关闭后恢复主 Session”的路线通过，则仍可交付一个符合“追问不污染主线”目标的 MVP；只是 sidecar 打开期间主对话为只读快照。

如果产品要求主对话和侧边对话必须同时可输入、同时流式运行，那么在路线 A 或路线 B 验证通过前，项目必须判定为 **No-Go**，不得通过私有 API 假装实现。

## 产品不变量

每一项实现任务都必须维护以下不变量：

1. 只在已完成的 Assistant 轮次边界 fork。
2. 创建或使用 sidecar 时，不得追加、截断、重命名、归档或以其他方式修改父 Session。
3. 关闭抽屉只改变 UI 状态，不删除 child Session。
4. child 提示词只发送给 child Session。
5. fork 失败或结果不确定时不自动重试。
6. 卸载插件后，child 仍是 Harness 可读取的普通 Session。
7. 禁止私有导入、DOM 选择器注入、monkey patch 或猜测 slot 契约。
8. 除非公共策略 API 真正强制执行，否则不得宣称工具副作用已经隔离。

## 计划中的仓库结构

```text
dsh-sidecar/
├── .github/workflows/ci.yml
├── docs/
│   ├── decisions/
│   ├── plans/
│   ├── research/
│   └── screenshots/
├── scripts/
│   ├── check-bundle.mjs
│   ├── check-release.mjs
│   └── clean.mjs
├── spikes/dual-session/
├── src/
│   ├── client/
│   │   ├── components/
│   │   ├── controllers/
│   │   ├── index.ts
│   │   └── locales.ts
│   ├── domain/
│   ├── host/
│   ├── css-modules.d.ts
│   └── index.ts
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   └── integration/
├── cordis.patch.yml
├── package.json
├── tsconfig.json
├── tsdown.config.ts
└── vitest.config.ts
```

## 发布门槛

- **门槛 A——第二 Session surface：** 在真实 Harness 中选择 ADR 0001 的路线 A、B 或 C。
- **门槛 B——能力声明：** 要么通过公共 API 强制 child 只读，要么明确说明只有对话记录隔离。
- **门槛 C——重启持久性：** 完整重启 `dsh` 后，父子 Session 均可读取并恢复关联。
- **门槛 D——打包安装：** 把生成的 `.tgz` 安装进干净 `web` profile，并通过端到端冒烟测试。
- **门槛 E——公开曝光：** 公开仓库、GitHub `dsh-plugin` Topic、npm 元数据、双语 README、演示素材和发布说明齐全。

### 任务 1：执行双 Session 可行性技术验证

**文件：**
- 新建：`spikes/dual-session/README.md`
- 新建：`spikes/dual-session/queries.md`
- 新建：`spikes/dual-session/result-template.md`
- 新建：`docs/research/dual-session-spike-results.md`
- 修改：`docs/decisions/0001-concurrent-session-surface.md`

**步骤 1：在隔离 profile 中安装精确测试基线**

运行：

```sh
npx @deepseek-ai/dsh@0.1.0-rc.6 web
```

预期：Web UI 启动并报告 Harness `0.1.0-rc.6`。把实际 profile 路径和构建哈希写入 `dual-session-spike-results.md`。

**步骤 2：写代码前记录实时公共契约**

通过正在运行的 Harness Cordis inspection 流程查询：

- Client 中包含 `session`、`runtime`、`slots`、`remote` 的 Service。
- conversation 根节点下的完整 slot 子树。
- Assistant 消息操作、conversation overlay 和 session-scoped surface 的精确标准 props。
- Host 中 fork、prompt、subscribe/open、close、archive 与 preset/tool policy 的方法。

把 provider 名、方法签名、slot 协议、scope 和版本原样写入 `spikes/dual-session/queries.md`。缺失的能力必须明确记录，不能通过推测补齐。

**步骤 3：验证创建 child 时不导航**

从一条已完成 Assistant 回答调用公开 fork 操作，并设置 `increaseTitle: false`。断言：

```text
fork 前的 parent session id === fork 后的 parent session id
child summary 可以寻址
child.parentId === parent.id
fork 前的 parent lastSeq === fork 后的 parent lastSeq
```

预期：通过。如果 selection 必然自动切换且没有公共接口阻止，路线 A 失败。

**步骤 4：验证向非 current child 发送提示词**

保持 parent 为 current，尝试向 child 发送提示词；仅通过公共订阅观察 child 的 streaming 和 cancellation。

路线 A 的预期：child 接受提示词，parent 保持 current，两条事件流都能独立读取。任何未导出模块依赖都判定路线 A 失败。

**步骤 5：验证两个渲染 surface 同时存在**

在一次性 Client 插件中挂载最小第二 Session surface，验证流式文本、工具卡、重试状态、重连及插件释放后的清理。

路线 A 的预期：两个 surface 都能更新，current selection 不移动，dispose 后全部订阅被释放。

**步骤 6：路线 A 失败时验证 B 和 C**

- 路线 B：验证同源嵌入、精确 Session 路由、CSP、焦点遍历与连接隔离。
- 路线 C：验证冻结父快照、草稿保存、滚动恢复，以及 child 关闭后重新打开 parent。

除非重新协商产品范围，否则不验证路线 D。

**步骤 7：完成 ADR 决策并提交**

把 ADR 0001 状态改为 `Accepted`，写明选定路线、观察到的公共契约和各条拒绝路线的证据。

运行：

```sh
git add spikes/dual-session docs/research/dual-session-spike-results.md docs/decisions/0001-concurrent-session-surface.md
git commit -m "docs: decide sidecar session rendering strategy"
```

### 任务 2：把规划仓库转换为可构建插件包

**文件：**
- 修改：`package.json`
- 新建：`pnpm-workspace.yaml`
- 新建：`tsconfig.json`
- 新建：`tsdown.config.ts`
- 新建：`vitest.config.ts`
- 新建：`src/index.ts`
- 新建：`src/client/index.ts`
- 新建：`src/css-modules.d.ts`
- 新建：`cordis.patch.yml`
- 新建：`scripts/clean.mjs`
- 新建：`scripts/check-bundle.mjs`

**步骤 1：先写 manifest 契约测试**

创建 `tests/manifest.spec.ts`，读取 `package.json` 并断言：

```ts
expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
expect(pkg.dsh.client.platform).toBe('web')
expect(pkg.exports['./client']).toBeDefined()
expect(pkg.files).toContain('cordis.patch.yml')
expect(pkg.keywords).toContain('dsh-plugin')
```

**步骤 2：运行测试并确认失败**

运行：`pnpm vitest run tests/manifest.spec.ts`  
预期：FAIL，因为当前规划 manifest 没有构建和 DSH 声明。

**步骤 3：替换为可发布 manifest**

使用以下依赖基线：

```json
{
  "name": "dsh-sidecar",
  "version": "0.1.0-beta.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-client-ui-slots"
      ]
    }
  }
}
```

所有 `@deepseek-ai/*` peer 和 dev dependency 都锁定到任务 1 验证通过的精确 RC。初始使用 `0.1.0-rc.6`，只有 spike 证据要求时才修改。

**步骤 4：增加最小 Host 与 Client 插件入口**

`src/index.ts` 导出具名 Cordis function plugin；`src/client/index.ts` 导出浏览器插件。两者只注册可清理的生命周期效果。`cordis.patch.yml` 只组合一次本包。

**步骤 5：构建并检查包内容**

运行：

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/check-bundle.mjs
pnpm pack --dry-run
```

预期：tarball 列表包含 Host 入口、Client 入口、声明文件、patch、README 和 LICENSE，不包含非必要源码。

**步骤 6：提交**

```sh
git add package.json pnpm-workspace.yaml tsconfig.json tsdown.config.ts vitest.config.ts src cordis.patch.yml scripts tests/manifest.spec.ts
git commit -m "build: scaffold installable dsh web plugin"
```

### 任务 3：定义稳定的 sidecar 领域模型

**文件：**
- 新建：`src/domain/types.ts`
- 新建：`src/domain/branch-index.ts`
- 新建：`src/domain/errors.ts`
- 测试：`tests/branch-index.spec.ts`

**步骤 1：编写失败的分支索引测试**

覆盖：

- 某回答没有 child；
- 同一锚点有两个 child；
- 不同 parent 的 child 不混合；
- 排除 subagent 后代；
- parent 缺失与血缘循环 fail-soft；
- 按创建时间和 id 稳定排序；
- 已归档 child 保留在已知集合，但从活动投影隐藏。

使用与 Harness 解耦的输入类型：

```ts
export interface SidecarSessionSummary {
  id: string
  parentId?: string
  seedLength?: number
  origin?: string
  createdAt: number
  archived: boolean
}

export interface SidecarAnchor {
  parentSessionId: string
  turnEndSeq: number
  seedLength: number
}
```

**步骤 2：运行并确认失败**

运行：`pnpm vitest run tests/branch-index.spec.ts`  
预期：因缺少 `buildBranchIndex` 而失败。

**步骤 3：实现纯派生索引**

实现 `buildBranchIndex(summaries, anchors)`，不得导入 React 或 Cordis。返回按 `(parentSessionId, turnEndSeq)` 和 child Session id 索引的映射。

**步骤 4：运行测试**

运行：`pnpm vitest run tests/branch-index.spec.ts`  
预期：PASS。

**步骤 5：提交**

```sh
git add src/domain tests/branch-index.spec.ts
git commit -m "feat: derive sidecar branches from session lineage"
```

### 任务 4：持久化锚点关联，但不污染 Session 日志

**文件：**
- 新建：`src/host/anchor-repository.ts`
- 新建：`src/host/derived-anchor-repository.ts`
- 条件新建：`src/host/profile-anchor-repository.ts`
- 测试：`tests/anchor-repository.spec.ts`
- 修改：`docs/decisions/0002-anchor-persistence.md`

**步骤 1：证明 `parentId + seedLength` 是否足够**

建立包含多 step、工具事件、steering 和分页历史的 fixture。根据 child `seedLength` 和 parent 事件窗口，推导点击的 Assistant 轮次 `turn/end`。

预期：完整 parent 历史可用后映射确定。

**步骤 2：选择持久化策略**

- 优先从官方 lineage 元数据推导。
- 如果推导有歧义，通过公共 Host Service 把 `{childId,parentId,turnEndSeq}` 写入插件自有 profile store。
- 在证明 cold-read 兼容、`ignorable` 语义和卸载行为前，不新增自定义 Session event。

**步骤 3：编写 repository 契约测试**

契约必须能跨进程重建，拒绝 child/parent 不匹配，对缺失元数据返回可恢复结果而不是编造锚点。

**步骤 4：实现最小通过版本**

暴露：

```ts
interface AnchorRepository {
  get(childSessionId: string): Promise<SidecarAnchor | undefined>
  put(childSessionId: string, anchor: SidecarAnchor): Promise<void>
  remove(childSessionId: string): Promise<void>
}
```

**步骤 5：提交**

```sh
git add src/host tests/anchor-repository.spec.ts docs/decisions/0002-anchor-persistence.md
git commit -m "feat: persist sidecar anchor associations"
```

### 任务 5：增加 Harness 适配层和原子 fork 协调器

**文件：**
- 新建：`src/client/controllers/session-gateway.ts`
- 新建：`src/client/controllers/fork-controller.ts`
- 测试：`tests/fork-controller.spec.ts`

**步骤 1：编写失败的行为测试**

验证协调器：

- 传递精确 parent id 和 Assistant 锚点 seq；
- 始终使用 `increaseTitle: false`；
- child 可在本地寻址后才记录锚点；
- 每个锚点只允许一个 in-flight 请求；
- timeout 或部分成功不自动重试；
- 用户选择已有 child 时直接返回；
- 成功和失败都不改变 parent selection。

**步骤 2：定义窄适配层**

```ts
export interface SidecarSessionGateway {
  fork(input: { sessionId: string; atSeq: number }): Promise<{ childId: string }>
  openChildSurface(childId: string): Promise<void>
  closeChildSurface(childId: string): Promise<void>
  prompt(childId: string, text: string): Promise<void>
  cancel(childId: string): Promise<void>
}
```

具体适配器必须来自任务 1 观察到的公共 API，不能从猜测的内部导入编写。

**步骤 3：实现 `ForkController`**

使用 `${parentId}:${turnEndSeq}` 作为 in-flight key，在 `finally` 中清理。对不确定错误提示“检查现有分支后再试”，不自动重试。

**步骤 4：验证**

运行：`pnpm vitest run tests/fork-controller.spec.ts`  
预期：PASS。

**步骤 5：提交**

```sh
git add src/client/controllers tests/fork-controller.spec.ts
git commit -m "feat: coordinate atomic sidecar forks"
```

### 任务 6：注册 Assistant 回答操作入口

**文件：**
- 新建：`src/client/components/SidecarAction.tsx`
- 新建：`src/client/components/SidecarAction.module.css`
- 修改：`src/client/index.ts`
- 测试：`tests/sidecar-action.spec.tsx`

**步骤 1：编写失败的组件测试**

断言：

- 开放轮次没有入口；
- User 或 steering 消息没有入口；
- 已完成 Assistant 尾部显示可用入口；
- 至少一个 child 后显示分支数量；
- 点击只发送一次精确 `sessionId` 和 `turnEndSeq`；
- disabled/busy 状态包含 `aria-disabled` 和本地化说明。

**步骤 2：查询并记录精确 slot**

把任务 1 得到的 slot 名、注册协议、owner props 和 standard props 写入源码注释。若固定 RC 中 slot 已消失，停止实现并更新兼容性决策。

**步骤 3：实现组件和注册**

使用 `slots.inject(...)`，并返回 `slots.register(...)` 的 disposer。不得查询 DOM，也不得替换整个 Assistant bubble。

**步骤 4：运行测试**

运行：`pnpm vitest run tests/sidecar-action.spec.tsx`  
预期：PASS。

**步骤 5：提交**

```sh
git add src/client/components src/client/index.ts tests/sidecar-action.spec.tsx
git commit -m "feat: add sidecar action to completed answers"
```

### 任务 7：构建抽屉壳并保留父视图状态

**文件：**
- 新建：`src/client/components/SidecarDrawer.tsx`
- 新建：`src/client/components/SidecarDrawer.module.css`
- 新建：`src/client/controllers/drawer-controller.ts`
- 新建：`src/client/controllers/parent-view-state.ts`
- 测试：`tests/sidecar-drawer.spec.tsx`
- 测试：`tests/parent-view-state.spec.ts`

**步骤 1：编写失败的 UI 状态测试**

覆盖 closed/open/creating/error、多个 child 切换、Escape 关闭、焦点返回和点击外部行为。关闭不得调用 archive 或 remove。

**步骤 2：编写失败的父状态测试**

捕获和恢复：

```ts
interface ParentViewState {
  sessionId: string
  scrollAnchorNodeId?: string
  scrollOffset: number
  draft: string
  focusedElement?: 'composer' | 'message-action' | 'other'
}
```

测试 child 关闭、页面 resize 和 child 打开失败后的恢复。

**步骤 3：实现抽屉壳**

- 桌面宽度限制在 360px 到 48vw。
- 保留主内容最小宽度。
- 只有覆盖式布局才使用 modal 焦点边界；并排布局让两个 pane 都进入正常 Tab 顺序。
- 提供可见关闭按钮和 `Escape` 处理。

**步骤 4：验证单元测试**

运行：

```sh
pnpm vitest run tests/sidecar-drawer.spec.tsx tests/parent-view-state.spec.ts
```

预期：PASS。

**步骤 5：提交**

```sh
git add src/client/components src/client/controllers tests/sidecar-drawer.spec.tsx tests/parent-view-state.spec.ts
git commit -m "feat: add persistent sidecar drawer shell"
```

### 任务 8：集成已选定的 child Session 渲染路线

**文件：**
- 按路线新建一个：
  - `src/client/components/NativeChildSurface.tsx`
  - `src/client/components/EmbeddedChildSurface.tsx`
  - `src/client/components/FrozenParentSurface.tsx`
- 修改：`src/client/components/SidecarDrawer.tsx`
- 新建：`tests/child-surface.contract.tsx`
- 新建：`tests/child-surface.spec.tsx`

**步骤 1：定义与路线无关的渲染契约**

```ts
interface ChildSurfaceProps {
  childSessionId: string
  onReady(): void
  onError(error: Error): void
  onRequestClose(): void
}
```

契约测试覆盖 ready、streaming、提交提示词、cancel、reconnect 和 dispose。

**步骤 2：只实现 ADR 批准的路线**

- 路线 A：通过验证后的公共 scope API 绑定显式 child Session。
- 路线 B：使用验证后的精确同源路由，以及仅允许 `location.origin` 的 schema 校验 `postMessage` bridge。
- 路线 C：左侧渲染已捕获父快照，child 关闭后恢复 parent。

生产适配器通过测试后删除 spike-only 代码。

**步骤 3：验证 parent 未被修改**

child 提示词发送前记录 parent `lastSeq`，child 完成后再次比较。预期：不变。

**步骤 4：运行契约测试**

运行：`pnpm vitest run tests/child-surface.spec.tsx`  
预期：选定路线 PASS。

**步骤 5：提交**

```sh
git add src/client/components tests/child-surface.contract.tsx tests/child-surface.spec.tsx
git commit -m "feat: render child session in sidecar drawer"
```

### 任务 9：恢复和管理持久分支

**文件：**
- 新建：`src/client/components/BranchTabs.tsx`
- 新建：`src/client/components/BranchMenu.tsx`
- 新建：`src/client/controllers/branch-controller.ts`
- 测试：`tests/branch-controller.spec.ts`
- 测试：`tests/branch-tabs.spec.tsx`

**步骤 1：编写失败的恢复测试**

仅从已持久化 Session summary 和锚点数据启动，断言无需创建新 Session 即可恢复入口数量、分支标题、上次选中 child 和归档过滤。

**步骤 2：实现分支选择和管理**

支持：

- 打开已有 child；
- 在同一回答再创建一个 child；
- 重命名 child；
- 明确确认后归档 child；
- 跳回 parent 锚点；
- 把仍可读取但关联丢失的 child 放入“未关联”区域。

**步骤 3：把 UI 偏好和对话数据分开**

只有 `lastSelectedChildByAnchor` 与抽屉宽度进入插件 UI 存储。child 消息只存在 Harness Session 持久化中。

**步骤 4：验证**

运行：

```sh
pnpm vitest run tests/branch-controller.spec.ts tests/branch-tabs.spec.tsx
```

预期：PASS。

**步骤 5：提交**

```sh
git add src/client/components src/client/controllers tests/branch-controller.spec.ts tests/branch-tabs.spec.tsx
git commit -m "feat: restore and manage persistent sidecar branches"
```

### 任务 10：定义并执行能力边界

**文件：**
- 新建：`src/domain/capability-policy.ts`
- 条件新建：`src/host/readonly-preset.ts`
- 新建：`src/client/components/CapabilityNotice.tsx`
- 测试：`tests/capability-policy.spec.ts`
- 修改：`README.md`
- 修改：`SECURITY.md`

**步骤 1：根据门槛 B 证据编写策略测试**

策略结果只能是：

```ts
type IsolationLevel =
  | { kind: 'enforced-readonly'; blockedCapabilities: string[] }
  | { kind: 'conversation-only'; warning: string }
```

不得仅因 UI 用途是“追问”就返回 `enforced-readonly`。

**步骤 2：如果任务 1 找到公共逐 Session 策略 API，则实现只读 preset**

排除文件写入、可变 Shell、Git 写操作、消息发送、支付和外部写入工具。测试 child 实际可见的 tool schema。

**步骤 3：否则发布明确的 conversation-only 提示**

显示：“主对话记录不会改变；工具可能仍影响共享工作区。” README 和 npm 描述不得宣称文件系统或外部操作已经隔离。

**步骤 4：验证**

运行：`pnpm vitest run tests/capability-policy.spec.ts`  
预期：PASS，文案与实际策略一致。

**步骤 5：提交**

```sh
git add src/domain src/host src/client/components tests/capability-policy.spec.ts README.md SECURITY.md
git commit -m "feat: make sidecar capability boundary explicit"
```

### 任务 11：增加本地化、无障碍与响应式行为

**文件：**
- 新建或修改：`src/client/locales.ts`
- 修改：`src/client/components/*.tsx`
- 修改：`src/client/components/*.module.css`
- 测试：`tests/accessibility.spec.tsx`
- 测试：`tests/locales.spec.ts`

**步骤 1：把全部用户文案放入 locale table**

提供中文与英文：创建、创建中、分支数量、关闭、重新打开、重命名、归档、重试提示、工具副作用提示、孤儿分支和连接失败。

**步骤 2：编写无障碍测试**

检查 accessible name、焦点进入和返回、Escape、streaming/error live region，以及主对话与抽屉之间没有键盘陷阱。

**步骤 3：实现响应式样式**

- 宽屏：并排抽屉。
- 窄屏：覆盖式 sheet，但保留父状态。
- 遵循 reduced motion 和 Harness theme token。
- 不硬编码全局颜色。

**步骤 4：运行测试**

```sh
pnpm vitest run tests/accessibility.spec.tsx tests/locales.spec.ts
```

预期：PASS。

**步骤 5：提交**

```sh
git add src/client tests/accessibility.spec.tsx tests/locales.spec.ts
git commit -m "feat: localize and harden sidecar accessibility"
```

### 任务 12：增加失败恢复和持久性测试

**文件：**
- 新建：`tests/integration/fork-persistence.spec.ts`
- 新建：`tests/integration/restart-recovery.spec.ts`
- 新建：`tests/integration/partial-success.spec.ts`
- 新建：`tests/fixtures/sessions/`
- 修改：`src/client/controllers/fork-controller.ts`

**步骤 1：测试进程重启**

创建 parent、fork child、发送两次 child 提示词、停止 Harness、重启 Harness，并重新打开二者。

预期：

- parent transcript 重启前后字节等价；
- child transcript 包含继承前缀和两轮 child 对话；
- 锚点关联可以重建；
- 重新打开抽屉不会再次 fork。

**步骤 2：测试部分成功**

模拟 Host 已发布 child，但 workspace attach 或 title 后续失败。协调器必须对账返回的 child id，并要求用户检查已有分支，不得重试生成重复 child。

**步骤 3：测试 streaming 中断线**

Assistant 输出部分 chunk 后断开连接，重连后验证 child transcript 连贯且用户提示词没有重复。

**步骤 4：运行集成测试**

运行：`pnpm vitest run tests/integration`  
预期：PASS。

**步骤 5：提交**

```sh
git add src/client/controllers tests/integration tests/fixtures
git commit -m "test: cover sidecar recovery and persistence"
```

### 任务 13：增加真实浏览器端到端覆盖

**文件：**
- 新建：`playwright.config.ts`
- 新建：`tests/e2e/sidecar.spec.ts`
- 新建：`tests/e2e/helpers.ts`
- 新建：`tests/e2e/snapshots/`

**步骤 1：编写端到端主场景**

自动执行：

1. 打开 parent Session；
2. 记录 parent id、滚动位置、草稿和 lastSeq；
3. 从一条较早的已完成回答创建 sidecar；
4. 追问两次；
5. 关闭再打开抽屉；
6. 刷新浏览器；
7. 重启 Harness 进程；
8. 重新打开同一 child；
9. 验证 parent id、草稿、锚点、lastSeq 和 transcript 均未改变。

**步骤 2：增加纯键盘和窄视口流程**

用 Tab/Enter/Escape 执行相同开关流程，并在移动端宽度重复。

**步骤 3：保存视觉证据**

保存：关闭状态入口、打开抽屉、多分支标签、刷新后恢复和能力提示截图。

**步骤 4：运行**

运行：`pnpm playwright test tests/e2e/sidecar.spec.ts`  
预期：PASS，无 console error，截图稳定。

**步骤 5：提交**

```sh
git add playwright.config.ts tests/e2e
git commit -m "test: verify sidecar flow in real harness web ui"
```

### 任务 14：增加 CI 与打包安装验证

**文件：**
- 新建：`.github/workflows/ci.yml`
- 新建：`scripts/check-release.mjs`
- 新建：`tests/integration/packed-install.ps1`
- 修改：`package.json`

**步骤 1：增加本地验证脚本**

必须包含：

```json
{
  "scripts": {
    "build": "pnpm run clean && tsc -p tsconfig.json && tsdown",
    "clean": "node scripts/clean.mjs",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "check:bundle": "node scripts/check-bundle.mjs",
    "release:check": "node scripts/check-release.mjs",
    "verify": "pnpm typecheck && pnpm test && pnpm build && pnpm check:bundle && pnpm release:check"
  }
}
```

**步骤 2：测试生成的 tarball**

运行：

```powershell
pnpm pack
./tests/integration/packed-install.ps1
```

脚本必须创建一次性 DSH profile，安装精确 `.tgz`，启动 Web UI，验证 Client bundle 返回 JavaScript 而不是 SPA HTML，然后运行冒烟流程。

**步骤 3：增加 CI matrix**

Node 22.19 和 24 都运行 typecheck/test/build/pack；Node 24 额外运行真实浏览器 smoke。pnpm 只按 lockfile 缓存。

**步骤 4：本地验证 CI 命令**

运行：`pnpm verify`  
预期：PASS。

**步骤 5：提交**

```sh
git add .github package.json scripts tests/integration/packed-install.ps1
git commit -m "ci: verify build and packed dsh installation"
```

### 任务 15：准备公开曝光资产和 Beta 发布

**文件：**
- 修改：`README.md`
- 新建：`README.en.md`
- 新建：`CHANGELOG.md`
- 新建：`docs/screenshots/`
- 新建：`.github/workflows/release.yml`
- 修改：`package.json`

**步骤 1：编写发布 README**

首屏必须包含：

- 一句话价值主张；
- 真实 GIF 或截图；
- 明确兼容性表；
- 一行安装命令；
- 一行卸载命令；
- 对话隔离与工具副作用的区别；
- Issue 和安全策略链接。

安装命令：

```sh
dsh plugin --profile web add dsh-sidecar
```

**步骤 2：完成 npm/GitHub 元数据**

- 只在发布提交中移除 `private: true`。
- 设置 repository、homepage、bugs、author、files、keywords 和 `publishConfig.access: public`。
- 设置 `publishConfig.provenance: true` 和预发布 tag `next`。
- peer range 只包含通过测试的 Harness RC。

**步骤 3：运行发布门槛**

```sh
pnpm verify
pnpm pack --dry-run
```

预期：PASS；tarball 只包含运行时、类型、patch、许可证和文档。

**步骤 4：发布并让别人发现**

得到仓库所有者明确批准后：

1. 创建公开 GitHub 仓库。
2. 添加 GitHub Topic：`dsh-plugin`、`deepseek-harness`、`conversation`、`sidecar`。
3. 推送签名/tagged `v0.1.0-beta.1` Release。
4. 通过 provenance 发布 npm `next` 版本。
5. 把公开包安装到干净 profile 并重新运行 smoke。
6. 带演示和兼容性警告在 Harness GitHub Discussions 和 Discord 公告。

**步骤 5：提交发布准备**

```sh
git add README.md README.en.md CHANGELOG.md docs/screenshots .github/workflows/release.yml package.json
git commit -m "docs: prepare dsh-sidecar beta release"
```

## v0.1 Beta 完成定义

- 用户可以用一行命令安装插件并重启 Harness。
- 已完成 Assistant 回答显示本地化 sidecar 入口。
- sidecar 可以创建、追问、关闭、重新打开、刷新，并在进程重启后恢复。
- sidecar 流程不改变 parent Session id、事件日志、草稿和浏览位置。
- 同一回答至少可以存在两个分支。
- 不存在私有 Harness 导入或 DOM 注入。
- 工具副作用文案与实际强制能力一致。
- 支持 RC 上的打包安装和真实浏览器测试通过。
- GitHub `dsh-plugin` Topic、npm keywords、双语文档、演示素材和兼容性表齐全。

## Beta 之后延期项

- 多抽屉或嵌套 sidecar。
- 把摘要引用回 parent Session。
- 移动端专属交互重构。
- 跨设备同步 UI 偏好。
- 通用 Session graph。
- 文件或 Git worktree 隔离。
- 在完整打包安装矩阵通过前支持更多 Harness RC。

