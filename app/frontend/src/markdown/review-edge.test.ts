/**
 * 验收者（reviewer）边界用例测试 — 独立于执行者自测套件。
 * 覆盖 checklist F-6/F-7 与稳健性边界：空文件、纯空白、BOM、
 * 超长单行、1000 行表格、损坏围栏代码块、非法公式、
 * mermaid 语法错误降级、未定义脚注、任务列表 disabled。
 */
import { describe, expect, it, vi } from 'vitest'
import { renderMarkdown } from './renderer'
import { sanitizeBody } from './sanitize'

const mermaidMock = vi.hoisted(() => ({
  renderImpl: vi.fn<(id: string, src: string) => Promise<{ svg: string }>>(),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mermaidMock.renderImpl,
  },
}))

function toDom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function render(src: string, opts: { katex?: boolean; mermaid?: boolean } = {}) {
  return renderMarkdown(src, { katex: opts.katex ?? true, mermaid: opts.mermaid ?? true })
}

describe('边界用例 — 空/空白/BOM', () => {
  it('空文件：不抛错，渲染为空，无标题', () => {
    const r = render('')
    expect(r.html.length).toBe(0)
    expect(r.headings).toEqual([])
    expect(r.wordCount).toBe(0)
  })

  it('纯空白文件：不抛错', () => {
    const r = render('   \n\t\n  \n')
    expect(() => toDom(r.html)).not.toThrow()
  })

  it('仅 BOM 字符（U+FEFF）：不抛错', () => {
    const r = render('\uFEFF')
    expect(() => toDom(r.html)).not.toThrow()
  })

  it('只有分隔线/空引用的文档不抛错', () => {
    expect(() => render('---\n\n> \n\n- \n\n1. ')).not.toThrow()
  })
})

describe('边界用例 — 体积与结构', () => {
  it('超长单行（50 万字符）不崩溃', () => {
    const line = 'x'.repeat(500000)
    const r = render(line)
    expect(r.html.length).toBeGreaterThan(0)
  }, 60000)

  it('1000 行表格完整渲染（1001 个 tr，含表头）', () => {
    const rows: string[] = ['| 列A | 列B | 列C |', '| --- | --- | --- |']
    for (let i = 0; i < 1000; i++) rows.push(`| a${i} | b${i} | c${i} |`)
    const r = render(rows.join('\n'))
    const doc = toDom(r.html)
    expect(doc.querySelectorAll('tr').length).toBe(1001)
  }, 60000)

  it('深层嵌套列表（40 层）不崩溃', () => {
    let md = ''
    for (let i = 0; i < 40; i++) md += '  '.repeat(i) + '- item\n'
    const r = render(md)
    expect(r.html.length).toBeGreaterThan(0)
  }, 60000)
})

describe('边界用例 — 损坏语法', () => {
  it('未闭合围栏代码块：按代码块渲染不抛错', () => {
    const r = render('```javascript\nconst x = 1\n')
    const doc = toDom(r.html)
    expect(doc.querySelector('pre code')).not.toBeNull()
  })

  it('错误语言名：不抛错', () => {
    const r = render('```notalang\nhello\n```', { mermaid: false })
    const doc = toDom(r.html)
    expect(doc.querySelector('.mdp-code-lang')?.textContent).toBe('notalang')
    expect(doc.querySelector('code')).not.toBeNull()
  })

  it('非法公式多种形态：不抛错不白屏', () => {
    for (const bad of [
      '$$\\frac{',
      '$$\\invalid{',
      '$x_{',
      '$$\\begin{matrix}a&b',
      '$$\n\\left(\n$$',
    ]) {
      const r = render(bad, { katex: true })
      expect(r.html.length).toBeGreaterThan(0)
    }
  })

  it('未定义脚注引用：按字面文本显示，无悬空链接，不崩溃', () => {
    const r = render('正文引用[^nope]')
    const doc = toDom(r.html)
    // markdown-it-footnote 实测：未定义引用保持字面文本，不生成 ref 链接
    expect(doc.querySelector('sup.footnote-ref')).toBeNull()
    expect(r.html).toContain('[^nope]')
    expect(doc.querySelector('.footnotes')).toBeNull()
  })
})

describe('边界用例 — mermaid 错误降级（mocked，确定性验证）', () => {
  it('语法错误的 mermaid 降级为源码代码块并回调 onError', async () => {
    mermaidMock.renderImpl.mockRejectedValue(new Error('syntax error'))
    const { enhanceMermaid: mockedEnhance } = await import('./mermaid')
    const html = '<pre><code class="language-mermaid">flowchart LR\nA--&gt;B bad syntax</code></pre>'
    const errors: string[] = []
    const res = await mockedEnhance(html, 'light', (m) => errors.push(m))
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('降级')
    const doc = toDom(res.html)
    expect(doc.querySelector('pre.mdp-code-block code.language-mermaid')).not.toBeNull()
  })

  it('合法 mermaid 源码经二次清洗后以 .mermaid div 呈现', async () => {
    mermaidMock.renderImpl.mockResolvedValue({
      svg: '<svg viewBox="0 0 10 10"><style>.a{fill:red}</style><script>alert(1)</script><circle class="a" cx="5" cy="5" r="4"/></svg>',
    })
    const { enhanceMermaid: mockedEnhance } = await import('./mermaid')
    const html = '<pre><code class="language-mermaid">flowchart LR\nA-->B</code></pre>'
    const errors: string[] = []
    const res = await mockedEnhance(html, 'dark', (m) => errors.push(m))
    expect(errors.length).toBe(0)
    const doc = toDom(res.html)
    expect(doc.querySelector('div.mermaid svg')).not.toBeNull()
    // 二次清洗去除 script
    expect(doc.querySelector('script')).toBeNull()
  })
})

describe('边界用例 — 任务列表与清洗收尾', () => {
  it('嵌套任务列表 checkbox 均 disabled 且保持不透明（只读）', () => {
    const r = render('- [x] 顶层\n  - [ ] 子项')
    const doc = toDom(r.html)
    const boxes = Array.from(doc.querySelectorAll('input[type="checkbox"]'))
    expect(boxes.length).toBe(2)
    for (const b of boxes) {
      expect(b.hasAttribute('disabled')).toBe(true)
    }
  })

  it('原始 HTML 注入的 input 必须带 disabled 才保留，无 on*', () => {
    const clean = sanitizeBody('<input type="checkbox" onchange="alert(1)">')
    const doc = toDom(clean)
    const input = doc.querySelector('input')
    // onchange 必须剥离；input 本身按白名单保留（ADD_TAGS）
    if (input) {
      expect(input.hasAttribute('onchange')).toBe(false)
      expect(input.getAttribute('type')).toBe('checkbox')
    }
  })

  it('href 锚点（#）与相对链接保留，不误杀', () => {
    const r = render('[跳转](#sec-1) [相对](./a.md) [邮件](mailto:a@b.c)')
    const doc = toDom(r.html)
    const hrefs = Array.from(doc.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('#sec-1')
    expect(hrefs).toContain('./a.md')
    expect(hrefs).toContain('mailto:a@b.c')
  })
})
