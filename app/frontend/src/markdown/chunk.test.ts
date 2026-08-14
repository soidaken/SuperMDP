/**
 * P1-1 分段渲染管线测试：
 * - splitChunks：fence/math 感知切块正确性（绝不切断代码块/块级公式）
 * - renderChunked：进度回调单调、分片调度结构（mock 计时）、
 *   分段渲染结果与全量渲染等价（标题集合/字数）
 * 注：jsdom 环境无 Worker，renderChunked 走主线程回退路径（行为等价）。
 */
import { describe, expect, it, vi } from 'vitest'
import { CHUNK_MAX_BYTES, renderChunked, splitChunks } from './chunk'
import { renderMarkdown, type ChunkResult } from './renderer'
import type { Heading } from './md-factory'

/** 收集一次 renderChunked 的完整结果（jsdom 无 Worker，走回退路径）。 */
function collect(
  src: string,
  opts = { katex: true, mermaid: true },
  maxBytes?: number,
): Promise<{ chunks: ChunkResult[]; done: { ms: number; words: number; total: number } }> {
  const chunks = maxBytes ? splitChunks(src, maxBytes) : splitChunks(src)
  return new Promise((resolve) => {
    renderChunked(chunks, opts, {
      onChunk: (_i, _t, r) => {
        /* 由外层收集 */
        void r
      },
      onDone: (ms, words, total) => resolve({ chunks: [], done: { ms, words, total } }),
      onError: (msg) => {
        throw new Error(msg)
      },
    }).promise
  })
}

/** 收集块列表（与 collect 互补：逐块累积结果）。 */
function collectChunks(
  src: string,
  maxBytes: number,
  opts = { katex: true, mermaid: true },
): Promise<{ chunks: ChunkResult[]; done: { words: number; total: number } }> {
  const chunks = splitChunks(src, maxBytes)
  return new Promise((resolve) => {
    const acc: ChunkResult[] = []
    renderChunked(chunks, opts, {
      onChunk: (_i, _t, r) => acc.push(r),
      onDone: (_ms, words, total) => resolve({ chunks: acc, done: { words, total } }),
      onError: (msg) => {
        throw new Error(msg)
      },
    }).promise
  })
}

describe('splitChunks — 分块正确性（P1-1）', () => {
  it('小文本单块返回；空文本返回空数组', () => {
    expect(splitChunks('# hi')).toEqual(['# hi'])
    expect(splitChunks('')).toEqual([])
  })

  it('大文本切成多块：每块 ≤ 上限（含行宽余量），且拼接还原原文', () => {
    const src = 'para line with some text\n'.repeat(8000) // ~110KB
    const chunks = splitChunks(src)
    expect(chunks.length).toBeGreaterThan(1)
    // 行级切块：末块可超上限至多一行长度（25 字符），余量 200 足够
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(CHUNK_MAX_BYTES + 200)
    }
    expect(chunks.join('')).toBe(src)
  })

  it('围栏代码块绝不被切断（块边界保持 fence 完整）', () => {
    // 构造：大段文本夹一个超长代码块，迫使切点落在代码块内部附近
    const filler = 'para\n'.repeat(5000)
    const code = '```typescript\n' + 'const line = 1;\n'.repeat(3000) + '```\n'
    const src = filler + code + filler
    const chunks = splitChunks(src, 4096)
    expect(chunks.length).toBeGreaterThan(2)
    const joined = chunks.join('')
    // 每块的 fence 开闭必须成对（块内不出现孤立的 ``` 行）
    for (const c of chunks) {
      const opens = (c.match(/^```/gm) || []).length
      expect(opens % 2, `块内 fence 不成对: ${opens}`).toBe(0)
    }
    // 高亮源码完整保留在某一块内
    expect(joined).toBe(src)
    const codeChunk = chunks.find((c) => c.includes('const line = 1;'))
    expect(codeChunk).toBeDefined()
    expect(codeChunk!.includes('```typescript')).toBe(true)
    expect(codeChunk!.includes('```\n')).toBe(true)
  })

  it('$$…$$ 块级公式绝不被切断', () => {
    const filler = 'para\n'.repeat(4000)
    const math = '$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n'
    const src = filler + math + filler
    const chunks = splitChunks(src, 2048)
    const mathChunk = chunks.find((c) => c.includes('\\int'))
    expect(mathChunk).toBeDefined()
    const opens = (mathChunk!.match(/^\$\$/gm) || []).length
    expect(opens).toBe(2) // 成对
  })
})

describe('renderChunked — 进度与调度（P1-1）', () => {
  it('进度回调单调递增，块数与 done 一致，字数累计正确', { timeout: 60000 }, async () => {
    // 多块：94KB 纯文本 → 2 块
    const src2 = ('# t' + 'x'.repeat(100) + '\n\n').repeat(900)
    const { chunks, done } = await collectChunks(src2, 60000)
    expect(done.total).toBe(chunks.length)
    expect(done.total).toBeGreaterThan(1)
    expect(done.words).toBeGreaterThan(0)
    // 单块小文档走 1 块
    const { done: d1 } = await collect('# 标题\n\n段落内容 paragraph\n\n'.repeat(500))
    expect(d1.total).toBe(1)
  })

  it('分片调度：每个任务片只处理一块（mock 计时验证渐进结构）', { timeout: 60000 }, async () => {
    vi.useFakeTimers()
    try {
      const src = '# h\n\nparagraph text\n\n'.repeat(60)
      const chunks = splitChunks(src, 200)
      const seen: number[] = []
      let finished = false
      let resolveDone: () => void = () => {}
      const done = new Promise<void>((r) => {
        resolveDone = r
      })
      renderChunked(chunks, { katex: true, mermaid: true }, {
        onChunk: (i) => seen.push(i),
        onDone: () => {
          finished = true
          resolveDone()
        },
        onError: () => {
          finished = true
          resolveDone()
        },
      })
      // 计时推进前不得有同步处理（渐进、不阻塞）
      expect(seen.length).toBe(0)
      // 每个任务片恰好处理一块（回退路径 setTimeout(1) 链）
      let guard = 0
      while (!finished && guard < 10000) {
        const before = seen.length
        await vi.advanceTimersByTimeAsync(1)
        if (!finished) {
          expect(seen.length - before).toBe(1)
        }
        guard++
      }
      expect(finished).toBe(true)
      await done
      expect(seen).toEqual(chunks.map((_, i) => i))
    } finally {
      vi.useRealTimers()
    }
  })

  it('分段渲染与全量渲染等价：标题 id 集合与字数一致（多块语料）', { timeout: 120000 }, async () => {
    // 纯结构语料（避免代码块/公式导致 html 膨胀拖慢 jsdom），24KB → 4 块
    const section = (
      '## 章节标题 ${i}\n\n段落文字 paragraph text，包含**强调**与[链接](https://example.com)。\n\n' +
      '- 列表项一\n- 列表项二\n\n> 引用内容引用内容\n\n### 小节标题\n\n结束段落。\n\n'
    )
    const src = Array.from({ length: 120 }, (_, i) => section.replace('${i}', String(i))).join('')
    const full = renderMarkdown(src, { katex: true, mermaid: true })
    const { chunks, done } = await collectChunks(src, 6000)
    expect(chunks.length).toBeGreaterThan(2)
    const acc: Heading[] = []
    let words = 0
    for (const c of chunks) {
      acc.push(...c.headings)
      words += c.wordCount
    }
    expect(done.words).toBe(words)
    expect(acc.map((h) => h.id)).toEqual(full.headings.map((h) => h.id))
    expect(words).toBe(full.wordCount)
  })
})
