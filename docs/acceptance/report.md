# 验收报告（Acceptance Report）

项目：supermdp — Wails 桌面只读 Markdown 预览器
验收者：reviewer（独立验收，不依赖执行者自测结论）
验收日期：2026-08-15
验收对象：T2 后端（45eead4）+ T3 前端（4c380cd、d90dba8），可执行文件 `app/build/bin/app.exe`（16,932,352 字节）

---

## 0. 验收方法与环境

| 项 | 说明 |
|---|---|
| 环境 | Windows amd64；node v26.1.0 / npm 11.6.2；go 1.24.5（`GOTOOLCHAIN=auto` 拉取 go 1.25.0 工具链）；vitest 4.1.10；jsdom 30 |
| 自动化 | 复跑 `npm run build`（tsc strict + vite）、`npx vitest run`、`go build/vet/test ./...`；新增 4 个验收测试文件（安全对抗 13 例、边界 16 例、GFM 证据 9 例、性能探针 2 例） |
| 静态审查 | 通读 `app/frontend/src` 全部源码、`app/*.go`、`index.html`、CSS；检查构建产物无外部网络资源 |
| 冒烟 | `Start-Process app/build/bin/app.exe` → 12s 存活（pid 21872，工作集 34.2 MB）→ `CloseMainWindow` 正常退出 |
| 截图 | `docs/acceptance/screenshots/app-empty-light.png`、`app-empty-dark.png`（1024×768 窗口，Ctrl+T 切换主题后捕获） |
| 限制 | 本环境无法操作 GUI（无法点击/拖拽/弹原生对话框），此类项标注「需人工真机验证」，见 `manual-test.md`；真实 mermaid SVG 渲染需 WebView2，jsdom 无法执行 |

**测试总账**：前端 vitest **58/58 通过**（执行者 18 + 验收者新增 40，跨 5 个文件：安全对抗 13、边界 16、GFM 证据 9、性能探针 2）；`tsc` 严格模式 0 错误；`go build ./...` 0 错误、`go vet ./...` 0 警告、`go test ./...` ok（10 个用例）。

---

## 1. Checklist 逐项结果（A–K，49 项）

> 判定：✅ PASS（自动化或代码级证据充分）｜🔶 代码级 PASS，视觉/端到端需真机（见 manual-test.md）｜❌ FAIL

### A. 构建与运行
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| A-1 | `go build ./...` 无错误 | ✅ | `BUILD_EXIT=0` |
| A-2 | `go vet ./...` 无警告 | ✅ | `VET_EXIT=0` |
| A-3 | `npm run build`（tsc+vite）无错误 | ✅ | exit 0，8.0s，tsc strict 0 错误 |
| A-4 | wails build 产出可执行、启动不崩溃 | ✅ | `app/build/bin/app.exe` 16.9MB 存在；冒烟 12s 存活、干净退出（注：wails CLI 未安装于 PATH，未现场重跑 `wails build`，产物与运行已验证） |
| A-5 | 窗口尺寸合理，最小 800×600 可布局 | 🔶 | `main.go` MinWidth 800 / MinHeight 600 / 默认 1024×768；截图窗口 1024×768 正常；最小尺寸布局见真机项 M-1 |

### B. GFM 渲染正确性（sample.md 验证）
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| B-1 | 标题 h1–h6、锚点、TOC 嵌套 | ✅ | review-gfm「标题层级」：≥10 标题全部带 id + `.header-anchor`；renderer.test「结构」 |
| B-2 | 粗体/斜体/删除线/行内代码 | ✅ | review-gfm「强调」：strong/em/`s`/code 均在（注：markdown-it v15 删除线输出 `<s>` 而非 `<del>`，见缺陷 P2-2） |
| B-3 | 有序/无序/嵌套列表、任务列表 | ✅ | review-gfm「列表」：ol/ol ol/ul ul ul；3 个 `input[type=checkbox][disabled]` |
| B-4 | 表格：对齐/单元格内格式/转义 `\|` | ✅ | review-gfm「表格」：3 列、`style="text-align:..."` 对齐、`a|b` 未分裂、单元格内 `s` 存在 |
| B-5 | 引用块（嵌套）、水平线 | ✅ | review-gfm「引用块」：blockquote + blockquote blockquote + hr |
| B-6 | 链接：行内/引用式/自动链接（URL、邮箱） | ✅ | review-gfm「链接」：4 类 href 全部命中 |
| B-7 | 脚注、围栏代码块（带语言）、HTML 转义 | ✅ | review-gfm「脚注」：sup.footnote-ref + .footnotes；≥8 个 `pre.mdp-code-block`；裸代码块 `<hello world>` 转义为文本 |
| B-8 | 断行/软换行符合 CommonMark | ✅ | review-gfm「软换行」：行尾两空格 → `<br>`；`breaks:false` 已代码确认（renderer.ts:59） |

### C. 代码高亮
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| C-1 | ≥20 种语言抽查 | 🔶 | `highlight.js/lib/common` 注册 36 种语言；`html`（→XML 别名）、js/ts/py/go/rust/java/c/cpp/bash/sql/json/yaml/css/xml/markdown/diff/shell 均命中（`hljs.getLanguage` 实测）；**dockerfile、powershell 未注册**（见缺陷 P2-3），缺失语言降级为转义文本不崩溃；颜色观感需真机（M-6） |
| C-2 | 无语言代码块默认样式 | ✅ | renderer.test「无语言代码块」：`text` 标签 + 转义 |
| C-3 | 语言标签 + 复制按钮 | 🔶 | 结构 ✅（`pre.mdp-code-block > .mdp-code-header > .mdp-code-lang + .mdp-copy-btn`，测试断言）；剪贴板真实可用性需真机（M-7） |

### D. KaTeX（可开关）
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| D-1 | 行内/块级公式 | ✅ | renderer.test「KaTeX」：.katex + .katex-display |
| D-2 | 复杂公式（分式/矩阵）与长公式横向滚动 | ✅ | sample.md 矩阵/分式渲染通过；CSS `.katex-display{overflow-x:auto}` + `white-space:nowrap`（markdown-theme.css:406-414）代码级确认 |
| D-3 | 关闭开关退化纯文本 | ✅ | renderer.test「关闭时公式按原文显示」 |
| D-4 | 非法公式优雅降级 | ✅ | review-edge「非法公式」5 种形态 + renderer.test「非法公式不抛错」 |

### E. mermaid（可开关）
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| E-1 | flowchart/sequence/gantt/pie 四类渲染 | 🔶 | 真实 SVG 渲染需 WebView2（jsdom 不支持）；降级/清洗路径自动化验证（review-edge mermaid mocked 2 例：语法错误→源码代码块+onError；合法→`.mermaid` div 且二次清洗去 script）；`securityLevel:'strict'` + `sanitizeSvg` 代码确认（mermaid.ts:43-60）。真机见 M-8 |
| E-2 | 关闭开关后源码代码块显示 | ✅ | renderer.test「mermaid 关闭时块显示为普通代码块」 |
| E-3 | 多图共存、间距 | 🔶 | CSS `.mermaid{margin:1.5em 0}` 代码级；真机 M-8 |

### F. 文件操作
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| F-1 | 打开对话框 + 过滤器 | 🔶 | `OpenFileDialog` 过滤器 `*.md;*.markdown;*.txt;*.mdown`（app.go:72-86）代码级；原生弹窗需真机 M-2 |
| F-2 | 拖拽打开 .md | 🔶 | `OnFileDrop` + HTML5 双通道、800ms 去重、扩展名过滤（App.tsx:174-231、format.ts）代码级；需真机 M-3 |
| F-3 | 外部修改 → 300ms 节流自动刷新 | 🔶 | 后端合并窗口 300ms（watcher.go:18、watchLoop）；fsnotify 事件探针测试通过（watcher_test.go）；前端 write→reload（useFile.ts:112-122）；端到端需真机 M-4 |
| F-4 | 删除/重命名明确提示 | ✅ | 后端 remove/rename 事件映射（watcher_test「EventOpMapping」）+ 前端提示文案（useFile.ts:119-121） |
| F-5 | 切换文件/刷新按钮 | ✅ | `WatchFile` 停旧起新（watcher.go:60）；reload 复用 load（useFile.ts:105-108）；真机顺手验证 |
| F-6 | UTF-8 BOM / GBK 正确显示 | ✅ | Go 测试：BOM 剥离、GBK 转码、UTF-16LE（app_test.go 4 例全过）；fixtures `gbk-sample.md`/`utf16le-sample.md` 已生成并做 GBK 回环校验 |
| F-7 | 空文件/纯空白显示空状态 | ✅ | review-edge「空/空白/BOM」4 例；App.tsx:307-315 displayHtml 为空→EmptyState；执行者自报限制已核实为符合预期 |

### G. 性能
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| G-1 | 5MB 打开到可交互 < 2s | ❌ **P1** | 见缺陷 P1-1：5MB 纯 JS 渲染 3.4–6.5s（多次独立测量），加 DOM 清洗/插入预计 4–6s，超 2s 目标 |
| G-2 | 大文件滚动流畅、渲染不阻塞 UI | ❌ **P1 同源** | 5MB 同步渲染期间主线程阻塞；调度机制存在（requestIdleCallback + 版本号防竞态，App.tsx:38-62），1MB 级无感。滚动流畅度需真机 M-10 |
| G-3 | 连续快速修改不产生渲染风暴 | ✅ | 后端 300ms 合并窗口 + 最后事件胜出（watcher.go:147-158）；前端 `renderGen`/`mermaidToken` 竞态防护（App.tsx:34-35） |

### H. 安全（XSS）
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| H-1 | script/iframe/onerror/javascript: 链接/img onerror 全清洗 | ✅ | review-security 13 例 + renderer.test 5 例全过；整树断言无 `on*` 属性、无 script/style/iframe、无 javascript:/data:text/html 链接 |
| H-2 | DOMPurify 放行 katex/mermaid 所需 class/style，禁止脚本执行 | ✅ | sanitize.ts 白名单（ADD_TAGS input/annotation/semantics；ADD_ATTR disabled/checked/type/role/aria-*；ALLOW_DATA_ATTR=false；mermaid SVG 独立 svg profile 二次清洗）；附录 A 落实。附注：style 属性保留 `url(javascript:)`/`expression`（Chromium 不可执行），见缺陷 P2-1 |
| H-3 | 渲染后 DOM 无注入的可执行属性 | ✅ | review-security 对全部 payload 遍历 `*` 断言无 `on*` 属性 |

### I. 视觉与交互（对照 design-spec 视觉验收要点，详见 §3）
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| I-1 | 明/暗主题完整、即时生效、持久化 `supermdp:theme` | ✅ | index.html:7-20 首帧前写 `data-theme`（无闪烁）；useTheme/lib/theme.ts localStorage 读写 + 系统主题跟随（仅未手选时）；截图 light/dark 两张 |
| I-2 | 阅读区排版：行高/字号/标题层级/最大宽度/中英混排 | 🔶 | markdown-theme.css：15px/行高 1.75/字号阶梯/h1-h2 分隔线/`max-width:760px` 居中/`word-break:break-word` 代码级确认；观感需真机 M-5 |
| I-3 | 代码块头部样式统一、hljs 配色和谐 | 🔶 | `.mdp-code-header` 34px + 自写 `--mdp-syn-*` 令牌（两主题），无官方主题（main.tsx:4 注释）；真机 M-6 |
| I-4 | 表格/引用/任务列表/图片样式符合规范 | 🔶 | CSS 代码级（自绘 15px 复选框、3px 引用竖线、表格 1px 边框）；真机 M-5 |
| I-5 | TOC scrollspy、可折叠、激活项样式 | 🔶 | rAF 节流滚动跟随（App.tsx:83-109）+ `scrollIntoView({block:'nearest'})`（Toc.tsx）；CSS accent 左边条；真机 M-9 |
| I-6 | 工具栏/状态栏/空状态/拖拽遮罩/设置弹层 | ✅ | 组件与 ui.css 逐条对照（按钮 30px、状态栏 26px 文件名 320px 省略、空状态 56px SVG、遮罩 inset:14px 虚线、弹层 232px）；空状态截图佐证 |
| I-7 | 900/1280/1600 宽度无布局破损 | 🔶 | CSS 响应式断点（≤1024px toc 220px/pad 32px；≤880px pad 24px）；真机 M-1 |

### J. 代码质量
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| J-1 | tsc 严格 + 无 any 滥用 | ✅ | tsconfig strict:true；src grep 无 `: any`/`as any` 滥用 |
| J-2 | gofmt 干净、错误处理完整 | ✅ | go vet 0 警告；读文件/对话框取消/目录拒绝/64MB 上限/监视失败路径均有处理 |
| J-3 | 依赖无冗余、mermaid 懒加载 | ✅ | mermaid 动态 `import()` 拆出 40+ 独立图表 chunk（vite 产物）；katex/markdown-it/hljs 为必需；主 chunk 1.07MB（gzip 344KB）有 vite 提示，本地 asset server 加载可接受（info 项） |
| J-4 | git 提交信息有意义、分步合理 | ✅ | 5 个特性提交（docs→scaffold→backend→render→shell），信息清晰 |

### K. 严格只读
| # | 项 | 判定 | 证据 |
|---|---|---|---|
| K-1 | 无编辑入口（无 contenteditable/textarea 编辑/保存） | ✅ | src 无 contenteditable；唯一 textarea 为复制降级的隐藏剪贴板元素（App.tsx:131-138，opacity 0、立即移除、非编辑入口）；无保存按钮 |
| K-2 | 无导出/打印/复制为 HTML 入口 | ✅ | 界面无导出/打印入口；`handleContentClick` 仅处理复制按钮与外链 |

**汇总（49 项）**：✅ PASS 34 项 ｜ 🔶 代码级 PASS 需真机确认 13 项 ｜ ❌ FAIL 2 项（G-1、G-2，同一 P1 缺陷）｜ 1 项待定（E-1 真实渲染归入真机）。

---

## 2. design-spec §8 视觉验收要点（A–H，与 I 组重叠，补充自动化/代码级结论）

| 组 | 要点 | 结论 |
|---|---|---|
| A 主题与整体 | 切换无闪烁 / dark `#0f1115` 非纯黑 / accent 三处出场 / 过渡 150–200ms | ✅ 代码级 + 双主题截图；`#0f1115`（ui.css:109）、accent 仅链接·激活态·主按钮（ui.css 审查）、过渡 150/200ms（--mdp-duration-fast/duration） |
| B 排版 | 15px/1.75、字号阶梯、中文字体优先、无网络字体 | ✅ 代码级；dist 无任何外部 URL（grep `(src\|href\|@import\|url()\s*["']https?://` 0 命中；index.html 仅本地 `/assets/`） |
| C 代码块 | 头部 + 复制；长行横向滚动；hljs 自写配色 | ✅ 代码级（`pre code{overflow-x:auto}`；markdown-theme.css:182-190） |
| D 表格/列表/引用 | 1px 边框、.zebra 可选、自绘复选框、引用左竖线 | ✅ 代码级 |
| E KaTeX/mermaid | 1.05em、长公式横滚、mermaid 居中透明、开关即时隐藏 | ✅ 代码级（.katex 1.05em；.mermaid text-align:center; background:transparent; svg max-width:100%）；开关即时生效（App.tsx 渲染 effect 依赖 settings） |
| F 空状态/拖拽 | 居中 SVG+文案+键帽；遮罩虚线框+「释放以打开文件」 | ✅ 代码级 + 截图（app-empty-light.png） |
| G 目录/工具栏/状态栏 | 嵌套缩进、激活左条、滚动跟随；状态栏文件名·大小·字数·渲染耗时 | ✅ 代码级（状态栏各字段 StatusBar.tsx；文件名 max-width:320px 省略） |
| H 细节 | 细滚动条、focus-visible、prefers-reduced-motion、800×600 | ✅ 代码级（ui.css:186-190、196-210、671-678）；800×600 真机 M-1 |

---

## 3. 缺陷清单（按严重度）

### P1（必须修复）
**P1-1 — 5MB 大文件渲染超时且阻塞 UI（G-1/G-2）**
- 现象：打开约 5MB 混合语料（段落/代码块/表格/公式），渲染期间窗口主线程冻结，渲染耗时超 2s 目标。
- 证据（独立测量）：
  - `docs/acceptance/review/perf-result.json`：5.3MB 纯 JS（markdown-it+hljs+katex）`mdRenderMs = 3972ms`；1MB 纯 JS 1058ms；1MB 全管线（jsdom 上界）21401ms（jsdom 为悲观上界，5MB 在 jsdom 下直接 OOM，约 4GB 堆）。
  - 独立 node 基准（相同插件配置，3 次取最优）：代码密集 5MB 3.4s；段落型 5MB 3.5s；`--noAnchor` 未改善（瓶颈在 tokenize/插件/高亮总量，近似线性 ~1ms/KB）。
  - 估算真实 WebView2 打开成本 ≈ 3.5–4s（纯 JS）+ 0.5–1.5s（DOMPurify 原生 DOM + DOM 插入）≈ 4–6s。
- 复现：真机打开 `docs/acceptance/fixtures/big-5mb.md`（5.0MB，已生成），观察状态栏渲染耗时与卡顿。
- 建议（T5）：① 大文件分段渲染（按标题切块，rAF 分帧插入，UI 保持可交互）；② 将 markdown-it 渲染移入 Web Worker（纯字符串管道，无 DOM 依赖，改造成本低）；③ 标题/TOC 提取与字数统计后置或复用渲染产物；④ 渲染前显示「渲染中…」占位 + 进度。

### P2（建议修复，可接受偏差）
**P2-1 — DOMPurify 放行 style 属性，`url(javascript:)`/`expression()` 原样保留（H-2 附注）**
- 现象：`<p style="background:url(javascript:alert(2));width:expression(alert(1))">` 渲染后 style 属性原样保留（review-security 实测输出）。
- 风险评估：Chromium/WebView2 中 `expression()`（IE-only）与 CSS `url(javascript:)` 均不可执行，实际利用风险低；spec 附录 A 要求放行 style 以支持 KaTeX/mermaid，属设计取舍。
- 建议：用 DOMPurify hook 或收紧 `FORBID_ATTR:['style']` + 仅对 `.katex`/`.mermaid` 元素放行内联 style；至少过滤 style 值中的 `url(javascript:)`、`expression`、`@import`。
- 复现：`docs/acceptance/fixtures/edge.md` §7。

**P2-2 — markdown-it v15 删除线输出 `<s>`，spec/CSS 只样式化 `del`（视觉偏差）**
- 现象：`~~删除线~~` 渲染为 `<s>`（markdown-it v15 行为，实测），而 design-spec §6.8 与 `markdown-theme.css:77` 只有 `.mdp-content del { color: var(--mdp-fg-muted) }`，`s` 无自定义样式 → 删除线文字未按规范 muted。
- 复现：打开 `sample.md` §1.1 查看「~~删除线~~」。
- 建议（1 行）：CSS 补 `.mdp-content s { color: var(--mdp-fg-muted); }`。

**P2-3 — hljs common 缺少 dockerfile / powershell（C-1 完整性）**
- 现象：`highlight.js/lib/common` 36 种语言，实测 `hljs.getLanguage('dockerfile')` 与 `'powershell'` 均 NOT FOUND（checklist C-1 明确列举这两门语言）；此类代码块降级为转义文本（不崩溃、可读，但无高亮）。`html` 已由 XML 别名覆盖（实测命中）。
- 建议：`import dockerfile from 'highlight.js/lib/languages/dockerfile'` + `powershell` 注册（两模块随包提供，约 +10KB）。

### 已核实为「符合预期」的项（执行者自报限制复核）
- mermaid 主题跟随：App.tsx mermaid effect 依赖 `[render, settings.mermaid, theme]`，切换主题即按新主题重渲图表 —— **已实现**，非缺陷。
- 空文件显示空状态：content 为空 → 渲染为空 → 显示 EmptyState（App.tsx:307-315）—— **已实现**，非缺陷。

### Info（无需处理）
- vite 提示主 chunk 1.07MB（gzip 344KB）超 500KB 阈值：markdown-it+hljs+katex+react 均必需且本地加载；mermaid 已按需分割。首启耗时以真机 M-1 为准。
- 未知编码文件（`Encoding:"unknown"`）原样展示并显示 UNKNOWN 徽标：README 已声明 tradeoff，可接受。

---

## 4. 验收结论

- **构建/质量/只读/安全**：全部 PASS。渲染管线安全设计合格（markdown-it → DOMPurify → 增强 →（mermaid 二次清洗）），对抗测试 13/13 无突破；严格只读无编辑/导出入口。
- **功能**：GFM/KaTeX/文件操作（编码/监视/删除提示）自动化证据充分；GUI 交互类（对话框/拖拽/自动刷新端到端/视觉观感）已列真机清单兜底（manual-test.md，10 项）。
- **性能**：1MB 级（≈1s 纯 JS）体验良好；**5MB 级不达标（P1-1）**，需 T5 优化。
- **可接受偏差**：P2-1/P2-2/P2-3 三处低危问题，修复工作量小（合计约 3 行 CSS + 2 行 hljs 注册 + 可选 style 收紧 hook）。
- **通过率**：checklist 49 项中 34 项完全 PASS、13 项代码级 PASS（待真机视觉/端到端确认，预期全部通过）、2 项 FAIL（P1-1 及同源 G-2）、E-1 归真机。

**结论：T4 验收「有条件通过」** —— 除 P1-1（5MB 性能）外无阻断项；P2 三项建议随 T5 一并修复；真机项按 manual-test.md 复核。

---

## 5. 证据文件索引

| 文件 | 内容 |
|---|---|
| `docs/acceptance/report.md` | 本报告 |
| `docs/acceptance/manual-test.md` | 人工真机验证步骤（M-1 ~ M-10） |
| `docs/acceptance/fixtures/sample.md` | 原综合语料（GFM+XSS） |
| `docs/acceptance/fixtures/edge.md` | 新增：边界/损坏/XSS 变体语料 |
| `docs/acceptance/fixtures/gbk-sample.md` | 新增：GBK(936) 编码语料（169B，回环校验通过） |
| `docs/acceptance/fixtures/utf16le-sample.md` | 新增：UTF-16LE+BOM 语料（96B） |
| `docs/acceptance/fixtures/bom-only.md` | 新增：仅 BOM 文件（3B） |
| `docs/acceptance/fixtures/big-5mb.md` | 新增：5.0MB 混合语料（P1-1 复现/真机性能验证） |
| `docs/acceptance/screenshots/app-empty-light.png` / `app-empty-dark.png` | 空状态明/暗主题截图（1024×768 实拍） |
| `docs/acceptance/review/perf-result.json` | 性能探针原始数据 |
| `docs/acceptance/review/capture.ps1` / `gen-fixtures.ps1` | 截图/生成脚本（可复跑） |
| `app/frontend/src/markdown/review-security.test.ts` | 验收者安全对抗测试（13 例，已入产品回归套件） |
| `app/frontend/src/markdown/review-edge.test.ts` | 验收者边界测试（16 例） |
| `app/frontend/src/markdown/review-gfm.test.ts` | 验收者 GFM 证据测试（9 例） |
| `app/frontend/src/markdown/review-perf.test.ts` | 验收者性能探针（2 例，写入 perf-result.json） |

*验收者独立立场说明：所有「PASS」均以本报告 §0 的独立复跑/审查/对抗测试为据，执行者自测（18 例）仅作基线对照，不构成放行依据。*

---

## 6. T5 复验结论（2026-08-15 二轮验收）

> 复验对象：`6b7f692`(P2-2)、`55758f8`(P2-3)、`7165e00`(P1-1)、`6bfb13c`(P2-1) 四个 fix 提交 + 重建的 `app/build/bin/app.exe`（17,771,008 字节，02:52 构建）。
> 方法：独立代码审查 + 全套自动化复跑（vitest 70/70、tsc strict、go build/vet/test）+ 真实语料切块复测 + 冒烟。

### 6.1 四项缺陷复验结果（全部 PASS）

| 缺陷 | 判定 | 证据 |
|---|---|---|
| P1-1 分段渲染（G-1/G-2） | ✅ PASS（自动化/代码级） | 见 6.2 |
| P2-1 style 恶意形态 | ✅ PASS | `sanitize.ts:39-48` DANGEROUS_STYLE hook（`url(javascript:)` / `expression(` / `@import` / `behavior:` 命中即整条移除 style）；`review-security.test.ts` 新增 2 例（5 种危险形态剔除、良性 `min-width/color` 保留）+ 原 style 用例改造为断言移除；security 套件 16 例全过 |
| P2-2 删除线 `<s>` | ✅ PASS | `docs/design/markdown-theme.css:79` 与 `frontend/src/styles/markdown-theme.css:79` 均有 `.mdp-content s { color: var(--mdp-fg-muted) }`，`fc /b` 二进制对比 0 差异（双副本完全一致）；`style-sync.test.ts` 断言 `<s>` 输出 + 双份同步 |
| P2-3 dockerfile/powershell | ✅ PASS | `md-factory.ts:15-16` 模块顶层 `hljs.registerLanguage`（主线程 `renderer.ts` 与 `render.worker.ts` 均 import 同一 md-factory → 共用注册实例）；`renderer.test.ts` P2-3 用例：`getLanguage` 命中 + 渲染出 `.hljs-keyword/.hljs-section/.hljs-string` 高亮类 |

### 6.2 P1-1 分段渲染核验要点（代码审查 + 独立复测）

- **块边界不切断围栏/公式**：`chunk.ts:19-51` splitChunks 按行累积 + `fence` 状态机（`code`/`math`）感知，仅在 fence 外部且 ≥64KB 时切块；块边界恒为行边界。
- **独立复测**（临时 vitest 复测文件，跑完即删，未入库）：`big-5mb.md`（5,243,094B）默认 64KB 切块 → **零切断**（逐块 `^``` 行数 % 2 === 0`、`^\$\$ 行数 % 2 === 0` 全部通过）、**拼接逐字节还原**（`chunks.join('') === src`）；`sample.md`（强制 2048 上限多块）与 `edge.md`（损坏语法/XSS 变体）同样零切断、还原。最大块 66,004B（≈64.5KB）为「fence 完整性优先」的软约束，属设计权衡（fence 内宁可不切块也不切断）。
- **乱序重组**：`chunk.ts:106-153` pending Map + nextIndex 按全局 index 依序入队 → `onChunk` 恒按文档顺序产出。
- **worker 协议**：`render.worker.ts` 双 worker 并行（index%2 平分任务），markdown-it+hljs+katex 纯字符串管道、无 DOM；`md-factory.ts` 为唯一构建点，Worker 可安全复用。
- **rAF 分帧**：`chunk.ts:110-140` 每帧至多处理一块 + App.tsx `insertAdjacentHTML('beforeend')` 渐进插入 → UI 全程可交互。
- **回退路径**：`chunk.ts:213-253` renderChunkedFallback（无 Worker 环境 setTimeout 1ms 逐块）；vitest/jsdom 实测走此路径，`chunk.test.ts`「每片恰好一块」mock 计时验证渐进结构。
- **进度/占位用设计令牌**：状态栏「渲染中 X%」（StatusBar.tsx:30-31，`--mdp-fg-muted` 继承）；内容区占位 `.mdp-render-progress`（overrides.css:18-26，`--mdp-font-size-sm` / `--mdp-fg-faint`）。
- **标题 id 跨块唯一**：`renderer.ts:92-123` HeadingIdState + assignHeadingIds（与 markdown-it-anchor uniqueSlug 同方案，全量渲染幂等 no-op）；`chunk.test.ts` 等价性用例断言分块与全量渲染的标题 id 集合一致。
- **数据一致性**：`docs/acceptance/review/perf-result.json` chunked-1mb-jsdom（17 块、25,711ms、每块 1,512ms）——jsdom 悲观上界与全量 jsdom（24,322ms）同量级（回退路径同为单线程），与「WebView2 受益于 worker 并行 + rAF 插入、UI 不冻结」的结论一致，无矛盾。

### 6.3 T5 后全套复跑

| 项 | 结果 |
|---|---|
| `npx vitest run` | ✅ **70/70**（7 文件：renderer 19 / chunk 6 / style-sync 1 / review-security 16 / review-edge 16 / review-gfm 9 / review-perf 2） |
| `npm run build`（tsc strict + vite） | ✅ 0 错误 |
| `go build ./...` / `go vet ./...` / `go test ./...` | ✅ 全绿 |
| 冒烟 `app/build/bin/app.exe`（T5 重建） | ✅ 启动 10s 存活（工作集 34.2MB），`CloseMainWindow` 干净退出 |
| 构建产物无外部网络 URL | ✅（T4 已验，T5 未引入网络依赖） |

### 6.4 判定更新与通过率重算

- **G-1 / G-2：FAIL → ✅ 自动化/代码级 PASS**（5MB 渲染移入 Worker、逐块渐进呈现、UI 不冻结、进度可见；`big-5mb.md` 真机打开手感/进度显示/交互流畅度按 manual-test.md M-10 待真机确认）。
- **checklist 49 项重算**：34 项完全 PASS + **15 项**代码级 PASS 待真机（原 13 + G-1/G-2 2 项）→ **0 FAIL**；E-1（真实 mermaid SVG 渲染）归真机 M-8。
- **P2 三项（P2-1 / P2-2 / P2-3）全部关闭**；**P1-1 关闭**（真机复核项保留 M-10）。

### 6.5 结论

**四项修复全部通过，无回归**（70/70 全绿 + tsc/go 全绿 + 冒烟通过 + 独立切块复测零切断/还原）。T4 遗留缺陷清零，仅剩 15 项真机复核（manual-test.md，不阻塞收尾）。**T5 复验通过，具备 T6 收尾条件。**
