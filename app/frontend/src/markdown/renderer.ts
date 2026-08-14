import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import texmath from 'markdown-it-texmath'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import { sanitizeBody } from './sanitize'

export interface RenderOptions {
  /** 启用 KaTeX（$...$ / $$...$$）。关闭时公式按原文显示。 */
  katex: boolean
  /** 启用 mermaid 图表。关闭时图表按代码块显示。 */
  mermaid: boolean
}

export interface Heading {
  level: number
  id: string
  text: string
}

export interface RenderResult {
  /** 已清洗、已增强（代码块头部）的 HTML 字符串 */
  html: string
  /** 提取出的标题（供 TOC 与滚动跟随） */
  headings: Heading[]
  /** 字数（CJK 字符数 + 拉丁词数） */
  wordCount: number
  /** 渲染耗时（ms），不含 DOM 插入 */
  renderMs: number
}

/** GitHub 风格 slug：小写、空白转连字符、保留 CJK 与字母数字。 */
function slugify(s: string): string {
  const slug = s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'section'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// markdown-it v15 的 default 导出为 class+namespace 合并，实例类型请用推断
function createMd(withKatex: boolean) {
  const instance = new MarkdownIt({
    html: true, // 放行原始 HTML，由 DOMPurify 在渲染后兜底清洗
    linkify: true,
    breaks: false, // 遵循 CommonMark：行尾两空格才软换行
    highlight(code: string, lang: string): string {
      // highlight 返回的内容会被 markdown-it 包进 <pre><code>，
      // 代码块头部（语言标签 + 复制按钮）在 enhanceCodeBlocks 中统一生成。
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        } catch {
          // 高亮失败按纯文本处理
        }
      }
      return instance.utils.escapeHtml(code)
    },
  })

  instance.use(anchor, {
    level: [1, 2, 3, 4, 5, 6],
    slugify,
    tabIndex: false,
    permalink: anchor.permalink.headerLink({
      symbol: '#',
      safariReaderFix: true,
    }),
  })

  // enabled:false → 复选框带 disabled=""（只读预览不可交互，spec §6.8）
  instance.use(taskLists, { enabled: false, label: false })

  instance.use(footnote)

  if (withKatex) {
    instance.use(texmath, {
      engine: katex,
      delimiters: 'dollars',
      katexOptions: { throwOnError: false, strict: false },
    })
  }
  return instance
}

// 两个实例：KaTeX 开/关。设置开关即时生效无需重建（渲染时按 opts 选择）。
const mdWithKatex = createMd(true)
const mdWithoutKatex = createMd(false)

/**
 * 把 markdown-it 输出的裸 <pre><code> 增强为 spec §6.9 约定的结构：
 * <pre class="mdp-code-block">
 *   <div class="mdp-code-header">
 *     <span class="mdp-code-lang">lang</span>
 *     <button class="mdp-copy-btn" type="button">复制</button>
 *   </div>
 *   <code class="language-lang">…</code>
 * </pre>
 * mermaid 启用时跳过 code.language-mermaid（由 mermaid.ts 替换为图表）。
 */
function enhanceCodeBlocks(root: HTMLElement, mermaidEnabled: boolean): void {
  root.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector(':scope > code')
    if (!code) return

    const langClass = Array.from(code.classList).find((c) => c.startsWith('language-'))
    let lang = langClass ? langClass.slice('language-'.length) : ''
    if (lang === 'mermaid' && mermaidEnabled) return // 留给 mermaid 渲染管线

    const cls = pre.classList
    if (cls.contains('mdp-code-block')) return // 幂等

    pre.classList.add('mdp-code-block')
    const header = document.createElement('div')
    header.className = 'mdp-code-header'
    const langSpan = document.createElement('span')
    langSpan.className = 'mdp-code-lang'
    langSpan.textContent = lang || 'text'
    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'mdp-copy-btn'
    copyBtn.textContent = '复制'
    header.append(langSpan, copyBtn)
    pre.prepend(header)
  })
}

/** 从清洗后的正文 DOM 提取标题（去掉锚点符号）。 */
function extractHeadings(root: HTMLElement): Heading[] {
  const headings: Heading[] = []
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const id = el.getAttribute('id')
    if (!id) return
    // headerLink（v9）把标题文字包在 .header-anchor 内（safariReaderFix 再包一层
    // <span>），取锚内文本并去掉可能的 "#" 符号，避免把符号算进目录文字。
    const anchor = el.querySelector(':scope > .header-anchor')
    let text = ((anchor?.textContent ?? el.textContent) || '').trim()
    text = text.replace(/^#?\s*/, '').replace(/\s*#\s*$/, '').trim()
    if (!text) return
    headings.push({ level: Number(el.tagName.slice(1)), id, text })
  })
  return headings
}

/** 统计字数：CJK 字符数 + 拉丁词数。 */
export function countWords(src: string): number {
  const cjk = (src.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g) || []).length
  const rest = src.replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, ' ')
  const latin = (rest.match(/[A-Za-z0-9_]+(?:['-][A-Za-z0-9_]+)*/g) || []).length
  return cjk + latin
}

/**
 * 渲染管线：markdown-it → DOMPurify 清洗 → 代码块增强 → 提取 TOC/字数。
 * 纯字符串/内存操作（除内部一个临时 detached DOM 用于增强），
 * 返回的 html 由 React 以 dangerouslySetInnerHTML 插入。
 */
export function renderMarkdown(src: string, opts: RenderOptions): RenderResult {
  const start = performance.now()
  const md = opts.katex ? mdWithKatex : mdWithoutKatex
  const rawHtml = md.render(src)
  const cleanHtml = sanitizeBody(rawHtml)

  // 临时容器做 DOM 级增强（不入主文档，零布局影响）
  const tmp = document.createElement('div')
  tmp.innerHTML = cleanHtml
  enhanceCodeBlocks(tmp, opts.mermaid)
  const html = tmp.innerHTML

  const headings = extractHeadings(tmp)
  const wordCount = countWords(src)
  const renderMs = Math.round(performance.now() - start)
  return { html, headings, wordCount, renderMs }
}

export { escapeHtml }
