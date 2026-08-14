/**
 * P2-2 删除线样式与 CSS 源/副本同步测试。
 * markdown-it v15 的 ~~x~~ 输出 <s>（非 <del>），design-spec §6.8 原 CSS 只
 * 样式化 del —— 修复为 del/s 同款 muted 后，这里验证：
 *  1) 渲染输出 <s> 元素；
 *  2) docs/design/markdown-theme.css（源）与 frontend/src/styles 副本
 *     都包含 `.mdp-content s`，且两份文件完全同步（防漂移）。
 *
 * 另含标题锚点可见性契约（真机反馈 bug）：markdown-it-anchor v9 headerLink
 * 把标题全文包进 .header-anchor，锚点若 opacity:0 隐藏会连标题一起不可见，
 * 因此锚点规则必须继承标题样式且不透明。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './renderer'

function toDom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/** 提取 CSS 中 .mdp-content .header-anchor 规则块（简化解析，足够断言关键契约）。 */
function anchorRule(css: string): string {
  const start = css.indexOf('.mdp-content .header-anchor')
  expect(start).toBeGreaterThan(-1)
  const brace = css.indexOf('{', start)
  const end = css.indexOf('}', brace)
  return css.slice(start, end + 1)
}

describe('P2-2 删除线 <s> 样式与 CSS 源/副本同步', () => {
  it('~~x~~ 输出 <s>（markdown-it v15），且样式文件同时覆盖 s', () => {
    const r = renderMarkdown('~~删除线~~ 与 ~~strike~~', { katex: true, mermaid: true })
    const doc = toDom(r.html)
    expect(doc.querySelectorAll('s').length).toBe(2)
    // docs/design 为源，frontend/src/styles 为副本 —— 必须同步（防漂移）
    const src = readFileSync(resolve(process.cwd(), '../../docs/design/markdown-theme.css'), 'utf-8')
    const copy = readFileSync(resolve(process.cwd(), 'src/styles/markdown-theme.css'), 'utf-8')
    expect(src).toContain('.mdp-content s')
    expect(copy).toContain('.mdp-content s')
    expect(src).toBe(copy)
  })
})

describe('标题锚点可见性契约（headerLink 包裹全文）', () => {
  it('headerLink 把标题文字包进 .header-anchor', () => {
    const r = renderMarkdown('# 主标题', { katex: true, mermaid: true })
    const doc = toDom(r.html)
    const h1 = doc.querySelector('h1')
    const anchor = h1?.querySelector(':scope > .header-anchor')
    expect(anchor).toBeTruthy()
    expect(anchor?.textContent).toContain('主标题')
  })

  it('锚点规则继承标题样式且不透明（禁止 opacity 隐藏标题）', () => {
    for (const file of [
      resolve(process.cwd(), '../../docs/design/markdown-theme.css'),
      resolve(process.cwd(), 'src/styles/markdown-theme.css'),
    ]) {
      const rule = anchorRule(readFileSync(file, 'utf-8'))
      expect(rule).toContain('color: inherit')
      expect(rule).not.toContain('opacity')
    }
  })
})
