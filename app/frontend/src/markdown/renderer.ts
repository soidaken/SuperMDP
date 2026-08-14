import { createMd, escapeHtml, slugify, type Heading, type RenderOptions } from './md-factory'
import { sanitizeBody } from './sanitize'

export type { Heading, RenderOptions }

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

/** 单块渲染结果（分段渲染管线用）。 */
export interface ChunkResult {
  html: string
  headings: Heading[]
  wordCount: number
}

// 两个实例：KaTeX 开/关。设置开关即时生效无需重建（渲染时按 opts 选择）。
const mdWithKatex = createMd(true)
const mdWithoutKatex = createMd(false)

/** 纯字符串渲染（无 DOM）：markdown-it 一次 render。Worker 内等同逻辑见 render.worker.ts。 */
export function renderRaw(src: string, opts: RenderOptions): string {
  return (opts.katex ? mdWithKatex : mdWithoutKatex).render(src)
}

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
function headingText(el: Element): string {
  // headerLink（v9）把标题文字包在 .header-anchor 内（safariReaderFix 再包一层
  // <span>），取锚内文本并去掉可能的 "#" 符号，避免把符号算进目录文字。
  const anchor = el.querySelector(':scope > .header-anchor')
  let text = ((anchor?.textContent ?? el.textContent) || '').trim()
  return text.replace(/^#?\s*/, '').replace(/\s*#\s*$/, '').trim()
}

function extractHeadings(root: HTMLElement): Heading[] {
  const headings: Heading[] = []
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const id = el.getAttribute('id')
    if (!id) return
    const text = headingText(el)
    if (!text) return
    headings.push({ level: Number(el.tagName.slice(1)), id, text })
  })
  return headings
}

/** 跨块全局标题 id 状态（P1-1 分块渲染）：每块只见到块内标题，重复文本的
 *  "章节-1/章节-2" 后缀必须跨块计数，否则 TOC 锚点跨块冲突。 */
export interface HeadingIdState {
  counts: Map<string, number>
  used: Set<string>
}

export function newHeadingIdState(): HeadingIdState {
  return { counts: new Map(), used: new Set() }
}

/**
 * 按文档顺序为标题分配全局唯一 id（含 .header-anchor href）。
 * 编号方案与 markdown-it-anchor 的 uniqueSlug 一致（base、base-1、base-2…，
 * 遇冲突跳过），因此对全量渲染是幂等 no-op，对分块渲染消除跨块重复 id。
 */
function assignHeadingIds(root: HTMLElement, state: HeadingIdState): void {
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const base = slugify(headingText(el))
    let n = state.counts.get(base) ?? 0
    let id = n === 0 ? base : `${base}-${n}`
    while (state.used.has(id)) {
      n++
      id = `${base}-${n}`
    }
    state.used.add(id)
    state.counts.set(base, n + 1)
    el.setAttribute('id', id)
    const a = el.querySelector(':scope > .header-anchor')
    if (a) a.setAttribute('href', `#${id}`)
  })
}

/** 统计字数：CJK 字符数 + 拉丁词数。 */
export function countWords(src: string): number {
  const cjk = (src.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g) || []).length
  const rest = src.replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, ' ')
  const latin = (rest.match(/[A-Za-z0-9_]+(?:['-][A-Za-z0-9_]+)*/g) || []).length
  return cjk + latin
}

/**
 * 处理一块 markdown-it 原始输出：DOMPurify 清洗 → 代码块增强 → 标题 id 归一化
 * → TOC/字数提取。供分段渲染管线（chunk.ts）逐块调用；单块 DOM 极小，主线程
 * 开销可控。idState 跨块共享以保证全局唯一标题 id。
 */
export function processChunk(
  rawHtml: string,
  chunkSrc: string,
  opts: RenderOptions,
  idState: HeadingIdState = newHeadingIdState(),
): ChunkResult {
  const cleanHtml = sanitizeBody(rawHtml)
  // 临时容器做 DOM 级增强（不入主文档，零布局影响）
  const tmp = document.createElement('div')
  tmp.innerHTML = cleanHtml
  enhanceCodeBlocks(tmp, opts.mermaid)
  assignHeadingIds(tmp, idState)
  return {
    html: tmp.innerHTML,
    headings: extractHeadings(tmp),
    wordCount: countWords(chunkSrc),
  }
}

/**
 * 渲染管线（同步全量）：markdown-it → DOMPurify 清洗 → 代码块增强 → 提取 TOC/字数。
 * 与分段管线（chunk.ts）结果一致，供测试与降级路径使用。
 */
export function renderMarkdown(src: string, opts: RenderOptions): RenderResult {
  const start = performance.now()
  const rawHtml = renderRaw(src, opts)
  const { html, headings, wordCount } = processChunk(rawHtml, src, opts)
  const renderMs = Math.round(performance.now() - start)
  return { html, headings, wordCount, renderMs }
}

export { escapeHtml }
