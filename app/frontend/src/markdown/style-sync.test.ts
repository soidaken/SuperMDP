/**
 * P2-2 删除线样式与 CSS 源/副本同步测试。
 * markdown-it v15 的 ~~x~~ 输出 <s>（非 <del>），design-spec §6.8 原 CSS 只
 * 样式化 del —— 修复为 del/s 同款 muted 后，这里验证：
 *  1) 渲染输出 <s> 元素；
 *  2) docs/design/markdown-theme.css（源）与 frontend/src/styles 副本
 *     都包含 `.mdp-content s`，且两份文件完全同步（防漂移）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './renderer'

function toDom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
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
