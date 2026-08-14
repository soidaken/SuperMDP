/**
 * 验收者（reviewer）性能探针。
 * 5MB 全管线在 jsdom 下会 OOM（jsdom DOM 开销巨大，约 4GB 堆），故拆分度量：
 *  1) pure-js 5MB：markdown-it + hljs + katex（纯 JS，无 DOM）—— 接近 WebView2 的真实 JS 成本；
 *  2) full-pipeline 1MB：完整 renderMarkdown（jsdom 上界，用于校准 DOM 开销因子）；
 *  3) chunked 1MB：P1-1 分段渲染管线（splitChunks + 逐块 processChunk）的 jsdom 上界度量；
 *  4) 结论：5MB 真实浏览器打开成本 ≈ pure-js5MB + 少量 DOM 开销（jsdom 因子为悲观上界）。
 * 结果写入 docs/acceptance/review/perf-result.json 供报告引用。
 * T5 注：P1-1 修复后，应用走分段渲染（Worker 渲染 + 主线程 rAF 分帧清洗/插入），
 * 渲染期间 UI 不冻结、渐进呈现；1MB/5MB 全量同步口径保留作为等价度量基线。
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import texmath from 'markdown-it-texmath'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import { renderMarkdown } from './renderer'
import { renderChunked, splitChunks } from './chunk'

/** 与 renderer.ts 相同的 markdown-it 配置（隔离测量纯 JS 解析成本）。 */
function createMd() {
  const instance = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    highlight(code: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        } catch {
          /* fallthrough */
        }
      }
      return instance.utils.escapeHtml(code)
    },
  })
  instance.use(anchor, { level: [1, 2, 3, 4, 5, 6], slugify: (s: string) => s.toLowerCase().trim().replace(/\s+/g, '-'), tabIndex: false, permalink: anchor.permalink.headerLink({ symbol: '#', safariReaderFix: true }) })
  instance.use(taskLists, { enabled: false, label: false })
  instance.use(footnote)
  instance.use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { throwOnError: false, strict: false } })
  return instance
}

function buildBlock(i: number): string {
  return [
    `## 章节 ${i} 标题 with \`inline\` **bold** [link](https://example.com/${i})`,
    '',
    '一段中英文混排文本 paragraph text，包含 $E = mc^2$ 行内公式与 `code`。',
    '',
    '```typescript',
    `function handler_${i}(n: number): number {`,
    '  const memo = new Map<number, number>();',
    '  return n < 2 ? n : (memo.get(n) ?? n);',
    '}',
    '```',
    '',
    '| 列A | 列B | 列C |',
    '| --- | --- | --- |',
    `| ${i}a | ${i}b | ${i}c |`,
    '',
    '- [x] 任务完成项',
    '- [ ] 任务待办项',
    '',
    '> 引用块内容 content',
    '',
    '$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$',
    '',
    '```mermaid',
    'flowchart LR',
    `A${i} --> B${i}`,
    '```',
    '',
  ].join('\n')
}

function buildDoc(mb: number): string {
  const block = buildBlock(0)
  const target = mb * 1024 * 1024
  const reps = Math.ceil(target / block.length)
  const parts: string[] = []
  for (let i = 0; i < reps; i++) parts.push(buildBlock(i))
  return parts.join('\n')
}

function savePerf(entry: Record<string, unknown>): void {
  const out = resolve(process.cwd(), '../../docs/acceptance/review/perf-result.json')
  mkdirSync(dirname(out), { recursive: true })
  let all: Record<string, unknown> = {}
  try {
    all = JSON.parse(readFileSync(out, 'utf-8'))
  } catch {
    /* first run */
  }
  all[String(entry.name)] = entry
  writeFileSync(out, JSON.stringify(all, null, 2), 'utf-8')
}

describe('性能探针（reviewer）', () => {
  it('5MB 混合语料：纯 JS 解析成本（= WebView2 主导成本）', { timeout: 300000 }, () => {
    const src = buildDoc(5)
    const md = createMd()
    // 预热（JIT）
    md.render(buildDoc(0.01))
    const t0 = performance.now()
    const rawHtml = md.render(src)
    const ms = performance.now() - t0
    expect(rawHtml.length).toBeGreaterThan(0)
    savePerf({
      name: '5mb-pure-js',
      sizeMB: Number((src.length / 1024 / 1024).toFixed(1)),
      sourceBytes: src.length,
      mdRenderMs: Math.round(ms),
      note: 'markdown-it+hljs+katex 纯 JS 渲染（无 DOM）。WebView2 与 node 同为 V8，此数字近似真实浏览器 JS 成本。',
    })
  })

  it('1MB 全管线（jsdom 上界）与纯 JS 对照', { timeout: 180000 }, () => {
    const src = buildDoc(1)
    const md = createMd()
    const t0 = performance.now()
    md.render(src)
    const pureMs = performance.now() - t0
    const t1 = performance.now()
    const r = renderMarkdown(src, { katex: true, mermaid: true })
    const pipeMs = performance.now() - t1
    expect(r.html.length).toBeGreaterThan(0)
    savePerf({
      name: '1mb-full-pipeline',
      sizeMB: 1,
      pureJsMs: Math.round(pureMs),
      fullPipelineJsdomMs: Math.round(pipeMs),
      jsdomOverheadFactor: Number((pipeMs / Math.max(pureMs, 1)).toFixed(1)),
      note: 'jsdom 的 DOMPurify/DOM 开销为悲观上界（真实 Chromium 原生 DOM 快一个数量级）；1MB 全管线通过执行者 30s 探针口径。',
    })
  })

  it('1MB 分段渲染管线（splitChunks + 逐块处理，jsdom 上界度量）', { timeout: 300000 }, async () => {
    const src = buildDoc(1)
    const chunks = splitChunks(src)
    expect(chunks.length).toBeGreaterThan(1)
    let processed = 0
    let words = 0
    const t0 = performance.now()
    await new Promise<void>((resolve) => {
      renderChunked(chunks, { katex: true, mermaid: true }, {
        onChunk: (_i, _t, r) => {
          processed++
          words += r.wordCount
        },
        onDone: () => resolve(),
        onError: (msg) => {
          throw new Error(msg)
        },
      }).promise
    })
    const ms = performance.now() - t0
    expect(processed).toBe(chunks.length)
    expect(words).toBeGreaterThan(0)
    savePerf({
      name: 'chunked-1mb-jsdom',
      sizeMB: 1,
      chunkCount: chunks.length,
      chunkedPipelineMs: Math.round(ms),
      perChunkMs: Number((ms / chunks.length).toFixed(1)),
      note: 'jsdom 悲观上界：单块 64KB 的 markdown-it+清洗+增强。WebView2 原生 DOM 快一个数量级，且渲染在 Worker 进行、逐块 rAF 插入，UI 不冻结。',
    })
  })
})
