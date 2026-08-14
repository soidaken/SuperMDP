# SuperMDP — 只读 Markdown 预览器

> 一个只做一件事的桌面 Markdown 预览器：打开 `.md` 文件，看到漂亮、专业的渲染结果。
> **不编辑、不导出**——纯粹地读。

基于 **Wails v2**（Go 后端 + 宿主系统 WebView2）与 **Vite + React + TypeScript** 构建。

## 特性

- **GFM 全特性渲染**：表格、任务列表、脚注、删除线、自动链接、嵌套引用
- **代码高亮**：36+ 种语言，自写明暗双主题配色（与整体色板同族）
- **数学公式**（KaTeX）与 **图表**（mermaid）：设置中可开关，按需懒加载
- **原生文件能力**：系统文件对话框、拖拽打开、文件变更自动刷新（300ms 节流）、UTF-8 BOM / GBK / UTF-16 编码自动识别
- **阅读体验**：明/暗主题（跟随系统、无闪烁切换）、可折叠目录 + 滚动跟随、键盘快捷键（`Ctrl+O` / `Ctrl+R` / `Ctrl+T` / `Ctrl+1`）
- **安全**：DOMPurify 清洗 + mermaid 二次清洗，XSS 对抗测试 13 例零突破
- **严格只读**：无任何编辑/导出入口

## 快速开始

前置：Go ≥ 1.25（自动切换）、Node ≥ 20、Windows 10/11（需 WebView2 运行时，通常已内置）。

```bash
# 开发模式（热重载）
cd app
wails dev

# 构建发行版（产出 app/build/bin/app.exe）
wails build

# 仅前端测试
cd app/frontend && npm install && npm test
```

## 项目结构

```
├── app/                      # Wails 应用（Go 后端 + React 前端）
│   ├── main.go / app.go      # 窗口配置与绑定服务
│   ├── watcher.go            # fsnotify 文件监视（300ms 节流）
│   ├── frontend/             # Vite + React + TS
│   │   └── src/
│   │       ├── markdown/     # 渲染引擎（markdown-it + 插件 + 清洗）
│   │       ├── styles/       # ui.css（令牌+外壳）→ markdown-theme.css（正文）
│   │       └── components/   # 工具栏 / 目录 / 阅读区 / 状态栏 / 弹层
├── docs/
│   ├── design/               # 设计规范 + 主题 CSS（源文件）
│   └── acceptance/           # 验收清单 / 报告 / 测试语料 / 真机清单
```

## 文档

| 文档 | 说明 |
|---|---|
| [docs/design/design-spec.md](docs/design/design-spec.md) | 设计规范：令牌、布局、交互、8 条设计决策（ADR） |
| [docs/acceptance/report.md](docs/acceptance/report.md) | 验收报告：49 项逐项结论 + 证据 |
| [docs/acceptance/manual-test.md](docs/acceptance/manual-test.md) | 真机验证清单（M-1 ~ M-12，GUI 交互兜底） |
| [docs/acceptance/fixtures/sample.md](docs/acceptance/fixtures/sample.md) | 综合测试语料（GFM + KaTeX + mermaid + XSS） |

## 渲染栈（全部成熟开源、离线可用）

`markdown-it` · `markdown-it-anchor` / `task-lists` / `footnote` / `texmath` · `highlight.js` · `KaTeX` · `mermaid` · `DOMPurify` · `fsnotify`（Go）

## 技术说明

- 正文排版作用域收在 `.mdp-content` 下，外壳类统一 `.mdp-` 前缀，设计令牌为 `--mdp-*` CSS 变量（`ui.css` 为唯一来源，`markdown-theme.css` 依赖其令牌，**加载顺序 ui.css 在前**）
- 大文件采用分段渲染 + 分帧插入，渲染期间 UI 保持可交互
- 图标全部为 inline SVG，无任何外部网络资源

## 许可

内部项目。渲染依赖库版权归各自作者所有。
