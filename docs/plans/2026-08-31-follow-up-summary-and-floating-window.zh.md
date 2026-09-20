# 追问摘要、段内高亮与浮动窗口 Implementation Plan

**Goal:** 让回答末尾能直接读到每条追问的摘要而不是“追问 1/2”，让段中发起的追问在原文里留下可点击的黄色高亮，并把追问面板从贴边抽屉改成可自由拖动、可八向缩放、会记住位置的浮动窗口。

**Architecture:** 摘要与高亮共用同一份锚点数据：首次发送追问时把该问题的单行摘要、选中片段及其字符偏移写进 Host `storageDomain` 里的 anchor 记录；回答段尾的 `SidecarAction` 读取 `branches()` 返回的富信息，用于渲染摘要下拉与在回答 DOM 内注入 `<mark>` 高亮。高亮层用纯 DOM 文本索引（`dom-text.ts`）定位，不依赖 `Range.toString()` 的边界语义，并在 Host 重渲染后按签名重新注入。窗口几何抽成纯函数模块（`window-geometry.ts`），组件只负责指针/键盘事件到几何变换的映射。

**Tech Stack:** React 18、TypeScript、`storageDomain` + 插件 RPC、zod、Vitest、Testing Library、jsdom、Harness 0.1.0-rc.6 插槽。

---

### Task 1: 锚点承载摘要与选区偏移

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/anchor.ts`（新增）
- Modify: `src/host/anchor-domain.ts`
- Modify: `src/client/controllers/persistent-anchor-repository.ts`
- Modify: `src/client/controllers/fork-controller.ts`
- Test: `tests/anchor-rpc.spec.ts`、`tests/persistent-anchor-repository.spec.ts`

**Step 1: Write the failing test**

断言 anchor 可携带可选 `summary` 与 `excerptOffset`，二者缺失时旧记录仍然合法；RPC 拒绝非法偏移（负数、非整数）。

**Step 2: Write minimal implementation**

`sidecarAnchor()` 成为唯一写入口，重建 anchor 时不再丢失可选字段；`followUpSummary()` 折叠空白并截断到 140 字符。域版本保持 `1`：只新增可选字段，旧存储记录仍然通过校验（换版本会让已存数据在打开时被拒绝）。

**Step 3: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run tests/anchor-rpc.spec.ts tests/persistent-anchor-repository.spec.ts`

Expected: PASS。

### Task 2: 段落内高亮与点击入口

**Files:**
- Add: `src/client/dom-text.ts`
- Add: `src/client/answer-highlight.ts`
- Modify: `src/client/controllers/selection.ts`
- Test: `tests/dom-text.spec.ts`、`tests/answer-highlight.spec.ts`、`tests/selection.spec.ts`

**Step 1: Write the failing test**

断言：按字符索引定位摘录并包装成 `<mark class="dsh-sidecar-highlight" role="button">`；同一目标集重复调用幂等；Host 重渲染抹掉标记后可重新注入；同一段文字被两条追问引用时按记录偏移分别命中；跨段落选区跳过而不是嵌套段落；清理后原标记与空行内元素都被还原。

**Step 2: Write minimal implementation**

`contentTextNodes()`/`answerText()`/`textOffsetOf()`/`rangeAtText()` 组成文本索引层；`locateExcerpt()` 先精确匹配、再退化为空白折叠匹配，并让 `offset` 与 `consumed` 决定用哪一次出现；`applyAnswerHighlights()` 用 `Range.extractContents()` 包装并在根节点写入签名，避免 MutationObserver 自触发循环。

**Step 3: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run tests/dom-text.spec.ts tests/answer-highlight.spec.ts tests/selection.spec.ts`

Expected: PASS。

### Task 3: 段尾摘要列表

**Files:**
- Modify: `src/client/controllers/sidecar-controller.ts`
- Modify: `src/client/components/SidecarAction.tsx`
- Modify: `src/client/locales.ts`
- Test: `tests/sidecar-controller.spec.ts`、`tests/sidecar-action.spec.tsx`

**Step 1: Write the failing test**

断言 `branches()` 返回 `{childId, summary, title, excerpt, excerptOffset, updatedAt}`；下拉框折叠态显示“已有追问（n）· 最新：摘要”，每项按摘要命名；无摘要时回退到 Host 标题、选中片段，最后才是“追问 n”。

**Step 2: Write minimal implementation**

`branchInfoOf()` 统一投影；组件按 `summary → title → excerpt → 位置标签` 选择标签并截断到 64 字符，`title` 属性保留全文。

**Step 3: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run tests/sidecar-controller.spec.ts tests/sidecar-action.spec.tsx`

Expected: PASS。

### Task 4: 可拖动、可缩放的浮动窗口

**Files:**
- Add: `src/client/window-geometry.ts`
- Modify: `src/client/components/SidecarDrawer.tsx`
- Modify: `src/client/styles.ts`
- Test: `tests/window-geometry.spec.ts`、`tests/sidecar-drawer.spec.tsx`

**Step 1: Write the failing test**

断言窗口默认停靠在右侧留白处；拖动标题栏任意位置（含标题文字，但落在按钮上的按下不算拖动）都按指针位移移动窗口，并在视口边缘收敛；拖动四条边与四个角缩放时对边不动、越界只截断尺寸而不平移窗口；键盘方向键移动 16px、`Shift`+方向键缩放 16px；点击“复位”回到默认框；几何写入 `localStorage`，再次打开时读回并收敛到当前视口。

**Step 2: Write minimal implementation**

`clampWindowRect`/`moveWindowRect`/`resizeWindowRect`/`nudgeWindowRect` 为纯函数；组件用指针捕获（无捕获能力时退化为普通监听）、CSS 变量传几何值，并在 `max-width:760px` 时退回全屏。

**Step 3: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run tests/window-geometry.spec.ts tests/sidecar-drawer.spec.tsx`

Expected: PASS。

### Task 5: 完整验证与文档

**Files:**
- Modify: `README.md`、`README.en.md`、`docs/product-spec.md`

**Step 1: Run the full suite**

Run: `node node_modules/vitest/vitest.mjs run`

Expected: 163 项全部通过。

**Step 2: Run static and build verification**

Run: `node node_modules/typescript/bin/tsc --noEmit`、`node node_modules/tsdown/dist/run.js`（或 `pnpm build`）、`node scripts/check-bundle.mjs`

Expected: 类型检查通过、bundle 契约 PASS。

**Step 3: Verify the served bundle**

请求 `http://127.0.0.1:4173/plugins/dsh-sidecar/client.js`，确认包含 `dsh-sidecar-window-handle`、`dsh-sidecar-highlight`、`excerptOffset` 等新符号，刷新页面即加载新版本。
