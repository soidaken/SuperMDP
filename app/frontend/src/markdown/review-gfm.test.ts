/**
 * 验收者（reviewer）GFM 特性证据测试 — 针对 docs/acceptance/fixtures/sample.md，
 * 为 checklist B 组（标题/强调/列表/表格/引用/链接/脚注/代码块/软换行）提供自动化证据。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './renderer'

function findSample(): string {
  const candidates = [
    resolve(process.cwd(), '../../docs/acceptance/fixtures/sample.md'),
    resolve(process.cwd(), '../docs/acceptance/fixtures/sample.md'),
    resolve(process.cwd(), 'docs/acceptance/fixtures/sample.md'),
  ]
  for (const c of candidates) {
    try {
      readFileSync(c)
      return c
    } catch {
      /* try next */
    }
  }
  return candidates[0]
}

const sample = readFileSync(findSample(), 'utf-8')

function toDom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('GFM 特性证据 — sample.md（reviewer）', () => {
  const r = renderMarkdown(sample, { katex: true, mermaid: true })
  const doc = toDom(r.html)

  it('标题层级 h1-h6 与锚点（B-1）', () => {
    const hs = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    expect(hs.length).toBeGreaterThanOrEqual(10)
    expect(hs[0]!.tagName).toBe('H1')
    for (const h of hs) {
      expect(h.id, '标题缺 id').toBeTruthy()
      expect(h.querySelector('.header-anchor')).not.toBeNull()
    }
  })

  it('强调：粗体/斜体/删除线/行内代码（B-2）', () => {
    expect(doc.querySelector('strong')).not.toBeNull()
    expect(doc.querySelector('em')).not.toBeNull()
    // markdown-it v15 的删除线输出 <s>（非 <del>）。
    // P2-2 修复：CSS 已同时样式化 s（muted），此处明确断言 <s> 存在。
    expect(doc.querySelector('s')).not.toBeNull()
    expect(doc.querySelector('p code')).not.toBeNull()
  })

  it('列表：有序/无序/嵌套 + 任务列表（B-3）', () => {
    expect(doc.querySelector('ol')).not.toBeNull()
    expect(doc.querySelector('ul')).not.toBeNull()
    expect(doc.querySelector('ol ol')).not.toBeNull()
    expect(doc.querySelector('ul ul ul')).not.toBeNull()
    expect(doc.querySelectorAll('ul.contains-task-list input[type="checkbox"]').length).toBe(3)
  })

  it('表格：对齐 + 单元格内格式 + 转义管道（B-4）', () => {
    const table = doc.querySelector('table')
    expect(table).not.toBeNull()
    const ths = Array.from(table!.querySelectorAll('th'))
    expect(ths.length).toBe(3)
    // markdown-it 以 style="text-align:..." 输出对齐
    const alignStyles = Array.from(table!.querySelectorAll('th, td'))
      .filter((c) => (c.getAttribute('style') ?? '').includes('text-align'))
    expect(alignStyles.length).toBeGreaterThan(0)
    // 转义管道：单元格内文字包含 a|b（而非分裂单元格）
    expect(table!.textContent).toContain('a|b')
    expect(table!.querySelector('s, del')).not.toBeNull()
  })

  it('引用块（含嵌套）与分隔线（B-5）', () => {
    expect(doc.querySelector('blockquote')).not.toBeNull()
    expect(doc.querySelector('blockquote blockquote')).not.toBeNull()
    expect(doc.querySelector('hr')).not.toBeNull()
  })

  it('链接：行内/引用式/自动链接（URL 与邮箱）（B-6）', () => {
    const hrefs = Array.from(doc.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('https://example.com')
    expect(hrefs).toContain('https://example.com/ref')
    expect(hrefs).toContain('https://example.com/docs') // autolink
    expect(hrefs.some((h) => (h ?? '').startsWith('mailto:'))).toBe(true) // 邮箱自动链接
  })

  it('脚注 + 围栏代码块（带语言）+ HTML 转义（B-7）', () => {
    expect(doc.querySelector('sup.footnote-ref')).not.toBeNull()
    expect(doc.querySelector('.footnotes')).not.toBeNull()
    expect(doc.querySelectorAll('pre.mdp-code-block').length).toBeGreaterThanOrEqual(8)
    // 无语言代码块内容被转义显示为文本
    const bare = Array.from(doc.querySelectorAll('pre code')).find((c) => !c.className.includes('language-'))
    expect(bare).toBeDefined()
    expect(bare!.textContent).toContain('<hello world>')
  })

  it('软换行（行尾两空格）→ <br>（B-8）', () => {
    expect(doc.querySelector('br')).not.toBeNull()
  })

  it('KaTeX 与 mermaid 块存在（D/E 组前置）', () => {
    expect(doc.querySelector('.katex')).not.toBeNull()
    expect(doc.querySelector('.katex-display')).not.toBeNull()
    expect(doc.querySelectorAll('code.language-mermaid').length).toBe(3)
  })
})
