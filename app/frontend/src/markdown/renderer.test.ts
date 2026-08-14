import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countWords, renderMarkdown } from './renderer'
import { sanitizeBody, sanitizeSvg } from './sanitize'

// 用验收语料 docs/acceptance/fixtures/sample.md 自测（GFM 全特性 + XSS 用例）
// vitest 工作目录可能是 frontend/ 或仓库根，探测多个候选路径
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

function render(src: string, opts: { katex?: boolean; mermaid?: boolean } = {}) {
  return renderMarkdown(src, { katex: opts.katex ?? true, mermaid: opts.mermaid ?? true })
}

function toDom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('renderMarkdown — 结构与标题', () => {
  it('生成带 id 与锚点链接的标题，并提取 TOC 标题', () => {
    const r = render(sample)
    expect(r.headings.length).toBeGreaterThanOrEqual(8)
    expect(r.headings[0]).toMatchObject({ level: 1, id: expect.any(String) })
    const doc = toDom(r.html)
    // 每个标题 id 都存在且带 .header-anchor
    for (const h of r.headings.slice(0, 5)) {
      const el = doc.getElementById(h.id)
      expect(el, `heading #${h.id}`).not.toBeNull()
      expect(el!.querySelector('.header-anchor')).not.toBeNull()
    }
  })

  it('TOC 标题文本不含锚点符号', () => {
    const r = render('# 标题\n\n## 子标题\n\n### 三级')
    expect(r.headings.map((h) => h.text)).toEqual(['标题', '子标题', '三级'])
    expect(r.headings.every((h) => !h.text.includes('#'))).toBe(true)
  })

  it('任务列表生成 disabled 复选框（只读预览）', () => {
    const r = render('- [x] 已完成\n- [ ] 未完成')
    const doc = toDom(r.html)
    const boxes = doc.querySelectorAll('li.task-list-item input[type="checkbox"]')
    expect(boxes.length).toBe(2)
    expect(boxes[0].hasAttribute('checked')).toBe(true)
    expect(boxes[0].hasAttribute('disabled')).toBe(true)
    expect(boxes[1].hasAttribute('checked')).toBe(false)
    expect(boxes[1].hasAttribute('disabled')).toBe(true)
    expect(doc.querySelector('ul.contains-task-list')).not.toBeNull()
  })

  it('脚注渲染', () => {
    const r = render('正文[^1]\n\n[^1]: 脚注内容')
    const doc = toDom(r.html)
    expect(doc.querySelector('sup.footnote-ref')).not.toBeNull()
    expect(doc.querySelector('.footnotes')).not.toBeNull()
  })
})

describe('renderMarkdown — 代码块（§6.9 结构）', () => {
  it('带语言代码块生成头部（语言标签 + 复制按钮）+ hljs 高亮', () => {
    const r = render('```javascript\nconst x = 1;\n```', { mermaid: false })
    const doc = toDom(r.html)
    const pre = doc.querySelector('pre.mdp-code-block')
    expect(pre).not.toBeNull()
    expect(pre!.querySelector('.mdp-code-lang')?.textContent).toBe('javascript')
    expect(pre!.querySelector('.mdp-copy-btn')).not.toBeNull()
    const code = pre!.querySelector('code.language-javascript')
    expect(code).not.toBeNull()
    expect(code!.querySelector('.hljs-keyword, .hljs-number, .hljs-title')).not.toBeNull()
  })

  it('无语言代码块显示 text 标签', () => {
    const r = render('```\n<plain>\n```', { mermaid: false })
    const doc = toDom(r.html)
    expect(doc.querySelector('.mdp-code-lang')?.textContent).toBe('text')
  })

  it('mermaid 开启时块保持裸 code.language-mermaid（留给渲染管线）', () => {
    const r = render('```mermaid\nflowchart LR\nA-->B\n```', { mermaid: true })
    const doc = toDom(r.html)
    const code = doc.querySelector('code.language-mermaid')
    expect(code).not.toBeNull()
    // 未包 mdp-code-block（没有头部）
    expect(code!.closest('pre.mdp-code-block')).toBeNull()
  })

  it('mermaid 关闭时块显示为普通代码块', () => {
    const r = render('```mermaid\nflowchart LR\nA-->B\n```', { mermaid: false })
    const doc = toDom(r.html)
    const pre = doc.querySelector('pre.mdp-code-block code.language-mermaid')
    expect(pre).not.toBeNull()
  })
})

describe('renderMarkdown — KaTeX 开关', () => {
  it('开启时行内/块级公式渲染为 .katex', () => {
    const r = render('行内 $E = mc^2$ 与块级：\n\n$$\n\\int x \\, dx\n$$\n', {
      katex: true,
    })
    const doc = toDom(r.html)
    expect(doc.querySelector('.katex')).not.toBeNull()
    expect(doc.querySelector('.katex-display')).not.toBeNull()
  })

  it('关闭时公式按原文显示，无 katex 输出', () => {
    const r = render('行内 $E = mc^2$', { katex: false })
    expect(r.html).toContain('$E = mc^2$')
    expect(r.html).not.toContain('katex')
  })

  it('非法公式不抛错、不白屏（优雅降级）', () => {
    const r = render('$$\\invalid{', { katex: true })
    expect(r.html.length).toBeGreaterThan(0)
  })
})

describe('安全（XSS）', () => {
  it('sample.md 中的恶意内容全部被清洗', () => {
    const r = render(sample)
    const doc = toDom(r.html)
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.querySelector('iframe')).toBeNull()
    expect(doc.querySelector('[onerror]')).toBeNull()
    // 真实链接的 href 不得为 javascript:（代码块内作为源码显示属正常）
    const anchors = Array.from(doc.querySelectorAll('a[href]'))
    for (const a of anchors) {
      expect(/^javascript:/i.test(a.getAttribute('href') ?? '')).toBe(false)
    }
  })

  it('行内注入不执行', () => {
    const r = render('<script>alert(1)</script> 与 <img src=x onerror=alert(1)>')
    expect(r.html).not.toContain('<script')
    expect(r.html).not.toMatch(/onerror/i)
  })

  it('javascript: 链接被剥离 href', () => {
    const r = render('<a href="javascript:alert(1)">危险链接</a>')
    const doc = toDom(r.html)
    const a = doc.querySelector('a')
    expect(a).not.toBeNull()
    expect(a!.getAttribute('href')).toBeNull()
  })

  it('data 属性被收紧（ALLOW_DATA_ATTR=false）', () => {
    const html = '<p data-x="1" class="keep">hi</p>'
    const clean = sanitizeBody(html)
    expect(clean).not.toContain('data-x')
    expect(clean).toContain('keep')
  })

  it('mermaid SVG 二次清洗保留 style 但去除脚本', () => {
    const svg =
      '<svg viewBox="0 0 10 10"><style>.a{fill:red}</style><script>alert(1)</script><circle class="a" cx="5" cy="5" r="4"/></svg>'
    const clean = sanitizeSvg(svg)
    expect(clean).not.toContain('<script')
    expect(clean).toContain('<style')
    expect(clean).toContain('viewBox')
  })
})

describe('字数统计', () => {
  it('CJK 字符 + 拉丁词混合统计', () => {
    expect(countWords('你好 world hello 世界')).toBe(6) // 4 CJK + 2 词
    expect(countWords('')).toBe(0)
    expect(countWords('a-b and c_d')).toBe(3)
  })
})

describe('性能探针（jsdom 解析远慢于真实 WebView2，仅防病态回归）', () => {
  it(
    '约 1MB 混合语料渲染不超时（jsdom 下 30s 为宽松上限）',
    { timeout: 120000 },
    () => {
      const block = [
        '## 章节标题 {id}',
        '',
        '一段**加粗**与 `行内代码` 混排的中英文文本，包含[链接](https://example.com)。',
        '',
        '```typescript',
        'function fib(n: number): number {',
        '  return n < 2 ? n : fib(n - 1) + fib(n - 2);',
        '}',
        '```',
        '',
        '| 列 A | 列 B |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        '- [x] 任务一',
        '- [ ] 任务二',
        '',
        '> 引用段落内容引用段落内容',
        '',
        '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
        '',
      ].join('\n')
      const src = block.repeat(Math.ceil((1024 * 1024) / block.length)) // ≈1MB
      const t0 = performance.now()
      const r = renderMarkdown(src, { katex: true, mermaid: true })
      const dt = performance.now() - t0
      console.log(`perf: ${(src.length / 1024 / 1024).toFixed(1)}MB → ${dt.toFixed(0)}ms (jsdom)`)
      expect(r.html.length).toBeGreaterThan(0)
      expect(dt).toBeLessThan(30000)
    },
  )
})
