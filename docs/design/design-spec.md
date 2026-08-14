# SuperMDP 设计规范（Design Spec）

> 只读 Markdown 预览器 · Wails v2 (Go + WebView2) · Vite + React + TypeScript
> 版本：v1.0 · 配套文件：`markdown-theme.css`（正文排版）、`ui.css`（应用外壳 + 设计令牌）

---

## 1. 产品定位与范围

- **产品**：Windows 桌面只读 Markdown 预览器。打开 `.md` 文件查看渲染结果，**无编辑、无导出**。
- **渲染栈**（全部为成熟开源库，离线可用）：
  - `markdown-it`（+ `markdown-it-anchor` / `markdown-it-task-lists` / `markdown-it-footnote`）
  - `highlight.js`（代码高亮，配色由本项目自写，见 §6.5）
  - `KaTeX`（数学公式，设置中可开关）
  - `mermaid`（图表，设置中可开关）
  - `DOMPurify`（渲染后安全清洗）
- **离线约束**：**严禁外部 CDN / 网络字体 / 网络资源**。所有样式、图标（inline SVG）、字体均为本地自带。

## 2. 设计基调（四原则）

1. **实用**：信息密度适中，一切元素服务于"读 Markdown"这一件事。
2. **好看**：克制的 1px 细边框、极淡阴影、大留白、清晰的字号阶梯与层级。
3. **高级**：低饱和色板、单一强调色、精确对齐、150–200ms 过渡；**无渐变、无发光、无花哨动效**。
4. **不花哨**：强调色只出现在链接、激活态、主按钮三处；默认状态一律 muted。

## 3. 全局约定（执行者务必一致）

| 约定 | 值 |
|---|---|
| 主题挂载点 | `<html data-theme="light\|dark">`；`:root` 放 light 值，`[data-theme="dark"]` 覆盖 dark 值 |
| 主题持久化 | `localStorage` key：`supermdp:theme`，值 `"light"` \| `"dark"`；首次打开跟随系统 `prefers-color-scheme`（JS 解析后写入 `data-theme`，CSS 不做 JS 前回退） |
| 字体 | 正文/界面：`"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif`；等宽：`"JetBrains Mono", Consolas, "Cascadia Mono", "SF Mono", Menlo, monospace`。中文优先 |
| 类名（外壳） | `.mdp-` 前缀：`.mdp-app` `.mdp-toolbar` `.mdp-toc` `.mdp-content` `.mdp-empty` `.mdp-statusbar` `.mdp-overlay` `.mdp-btn` `.mdp-icon-btn` `.mdp-popover` `.mdp-kbd` 等 |
| 类名（正文） | 裸标签选择器（`h1`–`h6`、`p`、`blockquote`、`pre`、`code`、`table`…），统一收在 `.mdp-content` 作用域下（见 §5 决策 D2） |
| 设计令牌 | CSS 自定义属性，`--mdp-*` 前缀，全部定义在 `ui.css` 顶部 `:root` 与 `[data-theme="dark"]` |
| 图标 | inline SVG，`stroke="currentColor"`，`stroke-width≈1.5`，16px（工具栏）/ 56px（空状态） |

## 4. 设计令牌（Design Tokens）

> 唯一来源：`ui.css` 顶部。`markdown-theme.css` 依赖这些令牌，**加载顺序 ui.css 在前**。

### 4.1 色板 — Light（`:root`）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--mdp-bg` | `#f7f8fa` | 应用底色（工具栏/目录/阅读区/状态栏） |
| `--mdp-bg-raised` | `#ffffff` | 浮起面：弹层、代码块头部 |
| `--mdp-bg-hover` | `#eef1f5` | 悬停态底色 |
| `--mdp-bg-active` | `#e4e9f0` | 按下态底色 |
| `--mdp-bg-sunken` | `#f1f3f6` | 凹陷面：表头、引用块底 |
| `--mdp-code-bg` | `#f2f4f7` | 代码块底色 |
| `--mdp-inline-code-bg` | `#eceff3` | 行内代码底色 |
| `--mdp-border` | `#e3e6eb` | 1px 细边框 |
| `--mdp-border-strong` | `#cfd5dd` | 强调边框（引用块、复选框） |
| `--mdp-fg` | `#1f2430` | 主文本 |
| `--mdp-fg-muted` | `#5b6472` | 次级文本 |
| `--mdp-fg-faint` | `#8b94a3` | 三级文本（占位、非激活目录项） |
| `--mdp-accent` | `#2563eb` | 强调色（链接/激活态/主按钮） |
| `--mdp-accent-hover` | `#1d4ed8` | 强调色悬停 |
| `--mdp-accent-soft` | `rgba(37, 99, 235, 0.10)` | 强调色淡底（激活项背景） |
| `--mdp-accent-contrast` | `#ffffff` | 强调色上的文字 |
| `--mdp-selection` | `rgba(37, 99, 235, 0.20)` | 文本选区 |
| `--mdp-scrollbar` | `#c9cfd8` | 滚动条 |
| `--mdp-scrollbar-hover` | `#aab2bf` | 滚动条悬停 |
| `--mdp-kbd-bg` | `#f1f3f6` | 快捷键键帽底 |
| `--mdp-kbd-border` | `#d4d9e0` | 键帽描边 |
| `--mdp-kbd-fg` | `#4b5563` | 键帽文字 |
| `--mdp-overlay-bg` | `rgba(15, 17, 21, 0.45)` | 拖拽遮罩半透明底 |
| `--mdp-overlay-border` | `rgba(255, 255, 255, 0.85)` | 拖拽遮罩虚线框 |
| `--mdp-overlay-fg` | `#ffffff` | 拖拽遮罩文字 |
| `--mdp-danger` | `#d1242f` | 错误/删除语义色（极少用） |

### 4.2 色板 — Dark（`[data-theme="dark"]`）

> 基调：低饱和深灰蓝底（`#0f1115`），**避免纯黑**；亮色面比底色略亮，用边框分层而非阴影。

| 令牌 | 值 | 用途 |
|---|---|---|
| `--mdp-bg` | `#0f1115` | 应用底色 |
| `--mdp-bg-raised` | `#151a21` | 浮起面 |
| `--mdp-bg-hover` | `#1a2029` | 悬停态 |
| `--mdp-bg-active` | `#212936` | 按下态 |
| `--mdp-bg-sunken` | `#0b0d10` | 凹陷面 |
| `--mdp-code-bg` | `#14181f` | 代码块底色 |
| `--mdp-inline-code-bg` | `#1c222c` | 行内代码底 |
| `--mdp-border` | `#232a35` | 细边框 |
| `--mdp-border-strong` | `#363f4d` | 强调边框 |
| `--mdp-fg` | `#e7eaf0` | 主文本 |
| `--mdp-fg-muted` | `#9aa3b2` | 次级文本 |
| `--mdp-fg-faint` | `#667085` | 三级文本 |
| `--mdp-accent` | `#6ea8fe` | 强调色（亮蓝，暗底可读） |
| `--mdp-accent-hover` | `#93c5fd` | 强调色悬停 |
| `--mdp-accent-soft` | `rgba(110, 168, 254, 0.14)` | 强调色淡底 |
| `--mdp-accent-contrast` | `#0d1117` | 强调色上的文字（暗色按钮用深字，对比度更佳） |
| `--mdp-selection` | `rgba(110, 168, 254, 0.30)` | 文本选区 |
| `--mdp-scrollbar` | `#2c3442` | 滚动条 |
| `--mdp-scrollbar-hover` | `#3e4a5c` | 滚动条悬停 |
| `--mdp-kbd-bg` | `#1a2029` | 键帽底 |
| `--mdp-kbd-border` | `#2e3745` | 键帽描边 |
| `--mdp-kbd-fg` | `#b8c2d0` | 键帽文字 |
| `--mdp-overlay-bg` | `rgba(10, 12, 16, 0.55)` | 拖拽遮罩底 |
| `--mdp-overlay-border` | `rgba(255, 255, 255, 0.80)` | 虚线框 |
| `--mdp-overlay-fg` | `#ffffff` | 遮罩文字 |
| `--mdp-danger` | `#f87171` | 错误/删除语义色 |

### 4.3 语法高亮色（hljs，`--mdp-syn-*`）

> 自写配色，与整体色板同族（函数/标题用 accent 蓝，注释用灰，字符串用绿，数字用琥珀，关键字用紫）。选择器见 `markdown-theme.css` §代码块。

| 令牌 | Light | Dark | 作用于 |
|---|---|---|---|
| `--mdp-syn-comment` | `#7d8590` | `#667085` | comment, quote（斜体） |
| `--mdp-syn-keyword` | `#7c3aed` | `#a78bfa` | keyword, selector-tag, type, meta.keyword |
| `--mdp-syn-string` | `#1a7f37` | `#6ee7b7` | string, regexp, addition, attribute |
| `--mdp-syn-number` | `#b45309` | `#fbbf24` | number, literal, symbol, bullet |
| `--mdp-syn-title` | `#2563eb` | `#6ea8fe` | title, title.function_, section, name |
| `--mdp-syn-builtin` | `#0891b2` | `#22d3ee` | built_in, builtin-name |
| `--mdp-syn-attr` | `#0f766e` | `#5eead4` | attr, variable, template-variable, selector-class/id/attr |
| `--mdp-syn-params` | `#374151` | `#cbd5e1` | params（正文色系） |
| `--mdp-syn-meta` | `#6b7280` | `#94a3b8` | meta（加粗） |
| `--mdp-syn-deletion` | `#d1242f` + `rgba(209,36,47,.10)` 底 | `#f87171` + `rgba(248,113,113,.14)` 底 | deletion |
| `--mdp-syn-addition` | `#1a7f37` + `rgba(26,127,55,.10)` 底 | `#4ade80` + `rgba(74,222,128,.14)` 底 | addition |

### 4.4 字体与字号

| 令牌 | 值 |
|---|---|
| `--mdp-font-sans` | `"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif` |
| `--mdp-font-mono` | `"JetBrains Mono", Consolas, "Cascadia Mono", "SF Mono", Menlo, monospace` |
| `--mdp-font-size-base` | `15px`（正文） |
| `--mdp-font-size-sm` | `13px`（目录、次要文字） |
| `--mdp-font-size-xs` | `12px`（状态栏、键帽、代码块头部标签） |

正文排版字号阶梯（相对正文 15px，`em` 单位）：

| 元素 | 字号 | 字重 | 备注 |
|---|---|---|---|
| h1 | `1.85em` (≈28px) | 700 | 底部 1px 细分隔线 |
| h2 | `1.5em` (≈22.5px) | 700 | 底部 1px 细分隔线 |
| h3 | `1.25em` (≈19px) | 600 | — |
| h4 | `1.1em` (≈16.5px) | 600 | — |
| h5 | `1em` | 600 | — |
| h6 | `0.9em` | 600 | muted 色 |
| 正文 p | `1em` | 400 | 行高 1.75 |
| 行内 code | `0.875em` | 400 | 等宽栈 |
| 代码块 code | `0.867em` (13px) | 400 | 行高 1.6 |
| 表格 | `0.9375em` | — | — |

### 4.5 间距 / 圆角 / 阴影 / 过渡 / 布局 / z-index

| 类别 | 令牌 | 值 |
|---|---|---|
| 间距（4px 基） | `--mdp-space-{1,2,3,4,5,6,8,10,12,16}` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 px |
| 圆角 | `--mdp-radius-sm` | `4px`（按钮/输入） |
| 圆角 | `--mdp-radius-md` | `6px`（弹层/代码块） |
| 圆角 | `--mdp-radius-lg` | `10px`（拖拽遮罩内框） |
| 圆角 | `--mdp-radius-full` | `999px`（开关/滚动条） |
| 阴影 | `--mdp-shadow-sm` | `0 1px 2px rgba(15,17,21,.05)`（dark: `.3`） |
| 阴影 | `--mdp-shadow-md` | `0 2px 8px rgba(15,17,21,.08)`（dark: `.4`） |
| 阴影 | `--mdp-shadow-lg` | `0 6px 24px rgba(15,17,21,.12)`（dark: `.5`） |
| 过渡 | `--mdp-duration-fast` | `150ms` |
| 过渡 | `--mdp-duration` | `200ms` |
| 缓动 | `--mdp-ease` | `cubic-bezier(0.2, 0, 0, 1)`（Fluent 风格） |
| 布局 | `--mdp-toolbar-h` | `44px` |
| 布局 | `--mdp-statusbar-h` | `26px` |
| 布局 | `--mdp-toc-w` | `240px`（≤1024px 时 220px） |
| 布局 | `--mdp-content-max-w` | `760px` |
| 布局 | `--mdp-content-pad` | `48px`（≤1024px: 32px；≤880px: 24px） |
| z-index | `--mdp-z-toolbar` | `100` |
| z-index | `--mdp-z-popover` | `300` |
| z-index | `--mdp-z-overlay` | `400` |

## 5. 布局说明

### 5.1 整体骨架（flex 纵向三段）

```
┌──────────────────────────────────────────────┐
│ .mdp-toolbar       高 44px（固定）              │  打开[主] · 刷新 · │ · 目录开关 · 主题 · 设置
├───────────────────┬──────────────────────────┤
│ .mdp-toc           │ .mdp-content             │
│ 宽 240px，可折叠   │ 纵向滚动区                │
│ 右 1px 边框        │  └ .mdp-content-body     │
│                   │     max-width 760px 居中  │
├───────────────────┴──────────────────────────┤
│ .mdp-statusbar     高 26px（固定）              │  文件名 · 大小 · 字数 · 渲染耗时
└──────────────────────────────────────────────┘
```

- `.mdp-app`：`display:flex; flex-direction:column; height:100vh`。
- `.mdp-main`：`display:grid; grid-template-columns: var(--mdp-toc-w) minmax(0,1fr); flex:1; min-height:0`。
- 目录折叠：`.mdp-main.toc-collapsed` → `grid-template-columns: 0 minmax(0,1fr)`，同时 `.mdp-toc` 隐藏右边框；`grid-template-columns` 用 200ms 过渡（Chromium 支持）。
- `.mdp-content`：`overflow-y:auto; overflow-x:hidden`，内部 `.mdp-content-body` 限宽居中：`max-width:760px; margin:0 auto; padding:40px 48px 64px`。
- 窗口最小 800×600（Go 侧约束）；CSS 需保证 900–1600px 宽度均好看，见 §5.3。

### 5.2 工具栏 / 状态栏内容排布

- **工具栏**（左 → 右）：应用名（可选，`.mdp-appname`，13px semibold muted）→「打开」主按钮 → 刷新图标钮 → 分隔线 `.mdp-toolbar-sep`（1×18px）→ *spacer* → 目录开关图标钮 → 主题图标钮 → 设置图标钮（`.mdp-popover-anchor` 包裹）。
- **状态栏**（左 → 右）：文件名（`.mdp-statusbar-filename`，500 字重，`max-width:320px` 省略号）→ 文件大小 → 字数 → 渲染耗时（如 `12 ms`）→ *spacer* → 快捷键提示 `Ctrl+O 打开`（`.mdp-kbd`）。
- 状态栏项之间 `gap:14px`，12px 字号，muted 色。

### 5.3 响应式

| 视口宽度 | 行为 |
|---|---|
| ≤1024px | `--mdp-toc-w:220px`；正文左右 padding 32px |
| ≤880px | 正文左右 padding 24px（800px 最小窗口仍可读） |
| 任意宽度 | 目录可手动折叠，折叠后阅读区独占 |

## 6. 组件与排版规格

### 6.1 按钮

- `.mdp-btn`：高 30px，左右 padding 14px，13px/500 字重，`bg-raised` + 1px `border`，圆角 4px；hover→`bg-hover`，active→`bg-active`；内置 15px 图标时与文字间距 6px。
- `.mdp-btn-primary`（打开）：`bg: accent; border: accent; color: accent-contrast`；hover→`accent-hover`。**唯一的主按钮**，accent 的三大出场位之一。
- `.mdp-icon-btn`：30×30 方形，无边框，`color: fg-muted`，hover→`bg-hover + fg`；激活态（如目录开关）→ `color: accent + bg: accent-soft`。

### 6.2 键盘快捷键 `.mdp-kbd`

- 键帽：`bg: kbd-bg; border: 1px solid kbd-border; 圆角 4px; padding: 1px 6px; font-family: mono; font-size: 0.85em; color: kbd-fg; box-shadow: 0 1px 0 kbd-border`。

### 6.3 目录侧栏 `.mdp-toc`

- 结构：`.mdp-toc-title`（"目录"，11px、600、`uppercase`、`letter-spacing:.08em`、faint）→ 项列表。
- 项 `.mdp-toc-item`：`display:block; padding:4px 18px; font-size:13px; color:fg-muted; border-left:2px solid transparent; white-space:nowrap; text-overflow:ellipsis`；hover→`fg + bg-hover`。
- **激活项**：`color:fg; background:bg-active; border-left-color:accent`（2px accent 左条 = 激活态出场位；整行不做强调色，避免刺眼）
- 嵌套层级用修饰类：`.lvl-1{ padding-left:18px } .lvl-2{32px} .lvl-3{46px} .lvl-4{60px} .lvl-5{74px} .lvl-6{88px}`（lvl-N 指标题级数 hN）。
- 滚动跟随：高亮当前视口内标题对应项（交互见 §7.4）。

### 6.4 空状态 `.mdp-empty`

- 内容区未打开文件时显示，垂直水平居中：
  - 56px inline SVG（文档+Markdown 符号，`stroke: currentColor`，faint 色）
  - 主文案「打开一个 Markdown 文件」（15px、600）
  - 提示行（13px muted）：`将文件拖入窗口` 与 `或按 Ctrl+O 打开`
- 无插画、无动画，留白充足。

### 6.5 拖拽遮罩 `.mdp-overlay`

- `position:fixed; inset:0; z-index:400`；`background: overlay-bg`（半透明）。
- 内层 `::before`：`inset:14px; border:2px dashed overlay-border; 圆角 10px`。
- 居中内容：40px 图标 + 「释放以打开文件」（15px、500、白）。
- 淡入淡出 200ms；隐藏态 `opacity:0; pointer-events:none`（class `.hidden`）。
- 仅在拖拽文件悬停窗口时显示。

### 6.6 设置弹层 `.mdp-popover`（KaTeX / mermaid 开关）

- 锚点：设置钮外包 `.mdp-popover-anchor{position:relative}`；弹层 `position:absolute; top:calc(100% + 8px); right:0; width:232px; z-index:300`。
- 外观：`bg-raised` + 1px 边框 + `shadow-md` + 圆角 6px，内边距 14px 16px。
- 开关 `.mdp-switch`：34×20 胶囊，`bg:border-strong`，圆钮 16px 白底；`aria-checked="true"` 时 `bg:accent`、圆钮右移 14px，150ms 过渡。
- 行：`.mdp-popover-row`（label 13px + 开关两端对齐）；标题 `.mdp-popover-title`（11px uppercase faint）。
- 开合：`.open` 类切换 `opacity` + `translateY(-6px→0)`，150ms；`Esc` 关闭，点击外部关闭。

### 6.7 滚动条（全局）

```css
::-webkit-scrollbar { width:10px; height:10px }
::-webkit-scrollbar-thumb { background:var(--mdp-scrollbar); border-radius:5px;
  border:2px solid transparent; background-clip:padding-box }
::-webkit-scrollbar-thumb:hover { background:var(--mdp-scrollbar-hover); background-clip:padding-box }
::-webkit-scrollbar-corner { background:transparent }
```

### 6.8 正文排版（`markdown-theme.css`，全部收在 `.mdp-content` 作用域）

| 元素 | 规格要点 |
|---|---|
| 正文 | 15px，行高 1.75，`color:fg`，`word-break:break-word` |
| 标题 | 见 §4.4 字号阶梯；行高 1.3；h1/h2 底部 1px `border`；`scroll-margin-top:64px`（滚动跟随锚定） |
| 链接 | `color:accent` 无下划线；hover 下划线 + `underline-offset:2px` |
| 强调 | `strong` 650–700；`del` 删除线 muted |
| 列表 | ul/ol `padding-left:26px`；li 间距 4px；嵌套列表 `margin:4px 0 0` |
| 任务列表 | 自绘复选框 15×15、圆角 4px、1.5px `border-strong`；选中：`bg:accent` + 白色勾（data-URI SVG）；`ul.contains-task-list` 去圆点、`li.task-list-item` 无列表符号；`:disabled` 保持不透明 |
| 引用块 | 3px 左 `border-strong` + `padding:4px 16px` + 淡 `bg-sunken` + muted 文字 |
| 分割线 | 1px `border`，上下 margin 32px |
| 行内 code | `bg:inline-code-bg`，圆角 4px，padding 2px 6px，0.875em 等宽 |
| 代码块 | 见 §6.9 |
| 表格 | 全宽、`border-collapse:collapse`、1px `border` 细边框、th 600 字重 + `bg-sunken`、单元格 padding 8px 12px；斑马纹**可选**：`table.zebra tbody tr:nth-child(even)` 用 `bg-hover` |
| 图片 | `display:block; max-width:100%; margin:24px auto; border:1px solid border; 圆角 4px` |
| 脚注 | `.footnotes`：顶部 1px 边框 + `margin-top:40px` + 13px muted；`sup.footnote-ref a` accent |
| KaTeX | `.katex{font-size:1.05em}`；`.katex-display{margin:24px 0; overflow-x:auto; overflow-y:hidden; padding:4px 0}`，内部 `white-space:nowrap` 保证长公式横向滚动 |
| mermaid | `.mermaid{margin:24px 0; text-align:center; background:transparent}`；`svg{max-width:100%; height:auto}` |
| 锚点链接 | headerLink 模式（markdown-it-anchor v9）：锚点包裹标题全文 `<h1 id><a class="header-anchor">标题文字</a></h1>`；`.header-anchor` 继承标题颜色/字号/字重、无下划线、`margin-left:0`，**完全可见**（严禁 opacity 隐藏，否则标题不可见） |

### 6.9 代码块结构与约束（头部由执行者实现 DOM，本项目只给配色与布局）

约定 DOM（执行者按此生成）：

```html
<pre class="mdp-code-block">
  <div class="mdp-code-header">
    <span class="mdp-code-lang">typescript</span>
    <button class="mdp-copy-btn" type="button">复制</button>
  </div>
  <code class="language-typescript">…hljs 高亮后的 HTML…</code>
</pre>
```

- `.mdp-code-block`：`margin:0 0 20px; border:1px solid border; 圆角 6px; background:code-bg; overflow:hidden`。
- `.mdp-code-header`：`display:flex; justify-content:space-between; align-items:center; height:34px; padding:0 12px; background:bg-raised; border-bottom:1px solid border; font-size:12px; color:fg-muted`。
- `.mdp-code-lang`：等宽栈、小写、`letter-spacing:.02em`。
- `.mdp-copy-btn`：22px 高、透明底、muted 字；hover→`bg-hover + border`；点击后 class `.copied` → 文字变「已复制」、`color:syn-addition`（1.6s 后还原）。
- `code`：`display:block; overflow-x:auto; padding:14px 16px; font-size:13px; line-height:1.6; background:transparent`（底色在 pre 上）。
- hljs 配色：按 §4.3 令牌写 `.hljs-comment` / `.hljs-keyword` / `.hljs-string` / `.hljs-number` / `.hljs-title` / `.hljs-built_in` / `.hljs-attr` / `.hljs-params` / `.hljs-meta` / `.hljs-deletion` / `.hljs-addition` / `.hljs-emphasis`(italic) / `.hljs-strong`(bold) 等选择器，**不引用任何官方主题**。

## 7. 交互说明

### 7.1 主题切换

1. 启动：读 `localStorage["supermdp:theme"]`；无值则用 `matchMedia('(prefers-color-scheme: dark)')` 判定，把结果写入 `document.documentElement.dataset.theme`。
2. 点击工具栏主题钮：在 `light` / `dark` 间切换 → 更新 `data-theme` → 写回 localStorage。
3. 系统主题变化：仅在用户未手动选择过（localStorage 无值）时跟随。切换过程无闪烁：`data-theme` 在首帧前设置（内联脚本或尽早执行）。

### 7.2 设置弹层

- 点设置钮开合 `.mdp-popover.open`；`Esc` 或点击弹层外部关闭。
- 两个开关即时生效并持久化（可复用 `supermdp:settings` 存 `{katex:true, mermaid:true}`，key 由执行者定，写入 spec 附录后同步）。
- 关闭 KaTeX/mermaid 时：对应渲染管线跳过、样式保留（隐藏元素）；无需重载文件。

### 7.3 拖拽打开

- 拖入：文件悬停窗口 → 显示 `.mdp-overlay`（移除 `.hidden`）。
- 释放：`e.dataTransfer.files[0]`，若扩展名为 `.md/.markdown` 则打开；否则状态栏短暂提示「不支持的文件类型」（danger 色）。
- 取消（Esc / 拖出窗口）：隐藏遮罩。遮罩本身不拦截鼠标（`pointer-events` 仅遮罩层生效）。

### 7.4 目录滚动跟随

- 阅读区滚动时，用 IntersectionObserver 或滚动位置计算当前标题；对应 `.mdp-toc-item` 加 `.active`，并 `scrollIntoView({block:'nearest'})` 保持可见。
- 点击目录项：平滑滚动到对应标题（`scroll-margin-top:64px` 抵消工具栏）。

### 7.5 快捷键（建议，执行者实现）

| 按键 | 动作 |
|---|---|
| `Ctrl+O` | 打开文件 |
| `Ctrl+R` / `F5` | 重新渲染当前文件 |
| `Ctrl+T` | 切换明暗主题 |
| `Ctrl+1` | 显示/隐藏目录 |
| `Esc` | 关闭弹层 / 拖拽遮罩 |

### 7.6 焦点与可达性

- 全局 `:focus-visible { outline:2px solid accent; outline-offset:2px }`（键盘导航可见、鼠标点击不显示）。
- `prefers-reduced-motion: reduce` 时所有过渡/动画时长归零。
- 正文对比度：正文 `fg` 对 `bg` 均 ≥ 7:1（light 约 13:1，dark 约 12:1）；muted 文本 ≥ 4.5:1。

## 8. 视觉验收要点（reviewer 对照清单）

> 验收时在 800×600 最小窗口、1280×800、1600×900 三种尺寸下分别检查 light / dark 两套主题。

**A. 主题与整体**
- [ ] light/dark 切换即时、无闪烁；重启后记住选择；首次启动跟随系统
- [ ] dark 底色为低饱和深灰蓝（≈`#0f1115`），**非纯黑**；无渐变、无发光
- [ ] accent 只出现在：链接、激活态（目录项/图标钮）、主按钮
- [ ] 全界面过渡 150–200ms，无多余动画

**B. 排版**
- [ ] 正文 15px、行高 1.75；标题字号阶梯清晰、h1/h2 有分隔线
- [ ] **标题文字完整可见**（headerLink 锚点包裹全文且继承标题样式，非透明；无下划线）
- [ ] 中文字体优先（雅黑/苹方），无网络字体请求（DevTools Network 无外部请求）
- [ ] 行内 code 底色与正文和谐；选区色为 accent 淡色

**C. 代码块**
- [ ] 有头部：语言标签 + 复制按钮；复制后变「已复制」并还原
- [ ] 长行横向滚动（竖向不溢出）；hljs 配色与明暗主题各自和谐（不是官方主题色）

**D. 表格 / 列表 / 引用**
- [ ] 表格 1px 细边框、表头加粗；`.zebra` 类可切换斑马纹
- [ ] 任务列表复选框为 accent 色、勾选清晰；`ul.contains-task-list` 无圆点
- [ ] 引用块左竖线 + 淡底 + muted 文字

**E. KaTeX / mermaid**
- [ ] 公式字号 ≈1.05em；长公式在容器内横向滚动、不撑破版面
- [ ] mermaid 居中、背景透明、`max-width` 不超内容区；设置里开关能即时隐藏对应内容

**F. 空状态 / 拖拽**
- [ ] 空状态居中：SVG 图标 + 「打开一个 Markdown 文件」+ 拖拽提示 + `Ctrl+O` 键帽
- [ ] 拖入文件出现半透明遮罩 + 白色虚线框 + 「释放以打开文件」；拖出/Esc 消失

**G. 目录 / 工具栏 / 状态栏**
- [ ] 目录项嵌套缩进正确；激活项有 accent 左边条；滚动时跟随高亮
- [ ] 工具栏元素紧凑对齐；目录折叠后阅读区平滑展开（无跳动）
- [ ] 状态栏显示：文件名（超长省略）· 大小 · 字数 · 渲染耗时

**H. 细节**
- [ ] 滚动条细、圆角、muted；悬停加深
- [ ] 键盘 Tab 遍历有可见 focus ring；`prefers-reduced-motion` 下无动画
- [ ] 800×600 下无遮挡、无横向溢出；900–1600px 宽度排版均正常

## 9. 设计决策记录（ADR）

| # | 决策 | 理由 |
|---|---|---|
| D1 | **强调色选靛蓝**：light `#2563eb` / dark `#6ea8fe` | 单一强调色需要"高级且稳妥"：靛蓝在 Windows/WebView2 语境中接近原生观感，对白/深底对比度均达标（≥4.5:1），且与中性灰蓝背景天然协调；不使用品牌红/绿，避免喧宾夺主 |
| D2 | **正文排版作用域收在 `.mdp-content` 下**（如 `.mdp-content h1`） | 桌面应用 DOM 全局共享，裸 `h1` 会污染弹层/空状态；"裸标签选择器"指不引入 .mdp- 类、以标签为选择器，作用域化是工程必需 |
| D3 | **dark 底 `#0f1115`（低饱和深灰蓝）** | 避免纯黑 OLED 过冲感与"廉价"印象；灰蓝与 accent 蓝同族，暗面分层靠 1px 边框而非阴影 |
| D4 | **dark 主按钮文字用深色 `#0d1117`** | accent 亮蓝上白字对比度仅 ≈2:1（不达标），深字 ≈7:1；视觉上更"高级"（VS Code 同款做法） |
| D5 | **hljs 配色自写并挂令牌** | 官方主题色与自有色板冲突；用 `--mdp-syn-*` 令牌让明暗两套自动切换、且函数/标题复用 accent 蓝形成体系感 |
| D6 | **复选框自绘（appearance:none + data-URI 勾）** | `accent-color` 无法控制边框/圆角细节；自绘 15px 圆角复选框与整体 1.5px 边框语言一致 |
| D7 | **表格斑马纹做成 `.zebra` 可选类** | 默认细边框 + 加粗表头已足够清晰，斑马纹留给大表格场景，避免默认样式过重 |
| D8 | **代码块头部 DOM 约定为 `.mdp-code-header` / `.mdp-code-lang` / `.mdp-copy-btn`** | 头部按钮交互（复制、已复制态）归执行者，本项目只锁结构、配色与布局约束，防止实现发散 |
| D9 | **标题锚点用 headerLink 包裹全文，且锚点完全可见** | markdown-it-anchor v9 的 headerLink 把标题文字整体包进 `.header-anchor`；若沿用"隐藏锚点、悬停显现"的旧模式会导致标题不可见（实测 bug）。因此锚点继承标题排版（颜色/字号/字重），无下划线、不透明；整行即链接 |
| D10 | **TOC 激活项不做整行强调色** | 原方案（accent 文字 + accent-soft 底 + accent 左条）在明暗两主题下均显刺眼；改为中性 `bg-active` 底 + 主文本 + 2px accent 左条，accent 仅作指示器，观感更克制高级 |

## 10. 交付物与依赖

| 文件 | 内容 | 依赖 |
|---|---|---|
| `design-spec.md` | 本文档 | — |
| `ui.css` | 设计令牌 + 外壳（工具栏/目录/阅读区/空状态/拖拽/状态栏/弹层/滚动条） | 无（**最先加载**） |
| `markdown-theme.css` | 正文排版 + hljs 配色 + KaTeX/mermaid/脚注/表格/任务列表 | 依赖 `ui.css` 令牌 |

### 附录 A：DOMPurify 注意项（供执行者）

- 需放行：`markdown-it-anchor` 的 `id`、`markdown-it-task-lists` 的 `type=checkbox`（`disabled`）、KaTeX 输出（`class` + 内联 `style` 中 `min-width/min-height`）、mermaid SVG 输出所需的 `class`/`style`/`aria-*` 属性。建议对 KaTeX/mermaid 的输出使用独立注入路径（渲染后再清洗）或配置允许的属性白名单，保证离线与安全兼得。

### 附录 B：建议快捷键与文案（集中维护）

- 快捷键：见 §7.5。
- 文案：空状态「打开一个 Markdown 文件」；拖拽「释放以打开文件」；复制按钮「复制/已复制」；设置弹层「渲染设置」+「数学公式 (KaTeX)」「图表 (mermaid)」。
