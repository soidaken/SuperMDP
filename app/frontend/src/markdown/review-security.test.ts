/**
 * 验收者（reviewer）安全对抗测试 — 独立于执行者自测套件。
 * 覆盖 checklist §H 与 design-spec 附录 A 之外的变体：
 * svg/math 命名空间、details ontoggle、style 注入、data: 链接、
 * 双写标签、实体编码绕过、属性大小写混淆、xlink/javascript: 等。
 * 结论性断言：渲染后 DOM 中不存在任何 on* 可执行属性、
 * javascript:/data:text/html 链接、script/style/iframe 元素。
 */
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './renderer'
import { sanitizeSvg } from './sanitize'

function toDom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

interface CleanResult {
  doc: Document
  html: string
}

/** 渲染并断言"绝对干净"：无 on* 属性、无危险 scheme、无可执行元素。 */
function expectClean(src: string, opts: { katex?: boolean; mermaid?: boolean } = {}): CleanResult {
  const r = renderMarkdown(src, { katex: opts.katex ?? true, mermaid: opts.mermaid ?? true })
  const doc = toDom(r.html)
  const all = Array.from(doc.querySelectorAll('*'))
  // 1) 无任何 on* 事件属性（含大小写混淆）
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      expect(
        /^on/i.test(attr.name),
        `可执行事件属性残留: <${el.tagName.toLowerCase()} ${attr.name}=...>（src 前缀: ${src.slice(0, 60)}）`,
      ).toBe(false)
    }
  }
  // 2) 无 script/style/iframe/object/embed/base/form 等可执行/表单元素
  for (const sel of ['script', 'style', 'iframe', 'object', 'embed', 'base']) {
    expect(doc.querySelector(sel), `${sel} 残留`).toBeNull()
  }
  // 3) 正文内链接不得为 javascript: / data:text/html / vbscript:
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = (a.getAttribute('href') ?? '').trim().toLowerCase()
    if (a.closest('pre, code')) continue // 代码块内为转义文本，非活动链接
    expect(
      !/^(javascript|vbscript|data:text\/html)/.test(href),
      `危险链接 href 残留: ${href}（src 前缀: ${src.slice(0, 60)}）`,
    ).toBe(true)
  }
  // 4) 危险 URI 属性（xlink:href / srcset / action）
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      const v = (attr.value ?? '').trim().toLowerCase()
      if (/^(javascript|vbscript|data:text\/html)/.test(v)) {
        expect(
          false,
          `危险 URI 残留: <${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`,
        ).toBe(true)
      }
    }
  }
  return { doc, html: r.html }
}

describe('安全对抗 — XSS 变体（reviewer 独立验证）', () => {
  it('svg 命名空间注入: <svg onload> / <svg><script> / <svg><a xlink:href=javascript:>', () => {
    const { doc } = expectClean(
      '<svg onload="alert(1)"><script>alert(2)</script><a xlink:href="javascript:alert(3)">x</a></svg>',
    )
    // svg 本身可能保留（无害），但其中不得再有可执行内容
    expect(doc.querySelector('svg script')).toBeNull()
    expect(doc.querySelector('svg a[xlink\\:href*="javascript"]')).toBeNull()
  })

  it('math/mtext 嵌套 img onerror', () => {
    expectClean(
      '<math><mtext><img src=x onerror="alert(1)"></mtext></math>',
    )
  })

  it('details open ontoggle 事件', () => {
    expectClean('<details open ontoggle="alert(1)"><summary>x</summary>body</details>')
  })

  it('P2-1 style 属性注入：url(javascript:) / expression() / @import / behavior: 形态被剔除', () => {
    // DOMPurify 按附录 A 放行 style（KaTeX/mermaid 需要），
    // 经 T5 修复：命中危险形态即整条移除 style（sanitize.ts DANGEROUS_STYLE hook）。
    const cases = [
      '<p style="width:expression(alert(1))">x</p>',
      '<p style="background:url(javascript:alert(2))">x</p>',
      '<p style="background:url( javascript : alert(3))">x</p>',
      '<p style="color:red;@import url(http://evil/x.css)">x</p>',
      '<p style="behavior:url(#default#time2)">x</p>',
    ]
    for (const src of cases) {
      const r = renderMarkdown(src, { katex: true, mermaid: true })
      const doc = toDom(r.html)
      const p = doc.querySelector('p')
      expect(p, `style 应被移除: ${src}`).not.toBeNull()
      expect(p!.hasAttribute('style'), `style 残留: ${src}`).toBe(false)
    }
  })

  it('P2-1 良性 style 保留（KaTeX/mermaid 所需形态不受影响）', () => {
    const r = renderMarkdown('<span style="min-width:1em;min-height:0.4em;color:#333">x</span>', {
      katex: true,
      mermaid: true,
    })
    const style = toDom(r.html).querySelector('span')?.getAttribute('style')
    expect(style).toContain('min-width')
    expect(style).toContain('color')
  })

  it('style 属性注入 expression / url(javascript:)：无脚本执行上下文', () => {
    const { doc, html } = expectClean('<p style="width:expression(alert(1));background:url(javascript:alert(2))">x</p>')
    // T5 修复后 style 被整条移除；此用例同时受 expectClean 全部整树断言约束
    expect(doc.querySelector('p')?.hasAttribute('style')).toBe(false)
    expect(html).not.toMatch(/<script/i)
  })

  it('data:text/html 链接（iframe srcdoc / a href）', () => {
    expectClean('<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>')
    expectClean('<iframe srcdoc="<script>alert(1)</script>"></iframe>')
  })

  it('双写标签 <scr<script>ipt> 与未闭合 script', () => {
    const r1 = renderMarkdown('<scr<script>ipt>alert(1)</scr<script>ipt>', { katex: true, mermaid: true })
    expect(toDom(r1.html).querySelector('script')).toBeNull()
    expectClean('<script>alert(1)')
  })

  it('实体编码/大小写/空白混淆: javas&#99;ript: / JaVaScRiPt: / <IMG ... ONERROR>', () => {
    expectClean('<a href="javas&#99;ript:alert(1)">x</a>')
    expectClean('<a href="JaVaScRiPt:alert(1)">x</a>')
    expectClean('<IMG SRC=x ONERROR=alert(1)>')
    expectClean('<svg onLoad = "alert(1)"> </svg>')
  })

  it('video/source/audio/form/input 事件与 autofocus', () => {
    expectClean('<video><source onerror="alert(1)"></video>')
    expectClean('<form><input onfocus="alert(1)" autofocus></form>')
    expectClean('<input type="image" src=x onerror="alert(1)">')
  })

  it('style 标签（@import 外链）被整体剥离', () => {
    const { html } = expectClean('<style>@import url("http://evil.example/x.css");body{}</style>')
    expect(html).not.toMatch(/@import/i)
  })

  it('markdown 语法内嵌 XSS（链接文本/引用/自动链接）', () => {
    expectClean('[x](javascript:alert(1))')
    expectClean('[x](vbscript:msgbox(1))')
    expectClean('![img](x onerror=alert(1))')
    expectClean('<http://evil.example/>') // 自动链接不执行
  })

  it('恶意内容位于代码块内时完全转义（不产生可执行 DOM）', () => {
    const r = renderMarkdown('```html\n<script>alert(1)</script><img src=x onerror=alert(1)>\n```', {
      katex: true,
      mermaid: true,
    })
    const doc = toDom(r.html)
    expect(doc.querySelector('pre code script')).toBeNull()
    expect(doc.querySelector('pre code img')).toBeNull()
    // 源码以文本呈现
    expect(doc.querySelector('pre code')?.textContent).toContain('<script>alert(1)</script>')
  })

  it('mermaid SVG 二次清洗：on*、script、javascript: href 全部去除，样式保留', () => {
    const dirty =
      '<svg viewBox="0 0 10 10" onload="alert(1)"><style>.a{fill:red}</style>' +
      '<script>alert(1)</script>' +
      '<a xlink:href="javascript:alert(2)"><circle class="a" cx="5" cy="5" r="4"/></a></svg>'
    const clean = sanitizeSvg(dirty)
    const doc = toDom(clean)
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.querySelector('[onload]')).toBeNull()
    expect(doc.querySelector('a[xlink\\:href*="javascript"]')).toBeNull()
    expect(clean).toContain('<style') // 样式需保留（KaTeX/mermaid 要求）
    expect(clean).toContain('viewBox')
  })

  it('sample.md 全语料渲染后整树无 on* 属性（含 mermaid 开关两态）', () => {
    const sample = `# 标题

<script>alert(1)</script> <img src=x onerror=alert(1)> <a href="javascript:alert(1)">链接</a>

| a | b |
| - | - |
| <svg onload=alert(1)></svg> | x |

\`\`\`mermaid
flowchart LR
A-->B
\`\`\`
`
    for (const mermaid of [true, false]) {
      const r = renderMarkdown(sample, { katex: true, mermaid })
      const doc = toDom(r.html)
      for (const el of Array.from(doc.querySelectorAll('*'))) {
        for (const attr of Array.from(el.attributes)) {
          expect(/^on/i.test(attr.name), `on* 残留: ${attr.name}`).toBe(false)
        }
      }
      expect(doc.querySelector('a[href*="javascript"]')).toBeNull()
    }
  })
})
