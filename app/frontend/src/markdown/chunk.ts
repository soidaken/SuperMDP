import {
  newHeadingIdState,
  processChunk,
  renderRaw,
  type ChunkResult,
  type HeadingIdState,
  type RenderOptions,
} from './renderer'

/** 分块上限：每块约 64KB 源码 → 单块 markdown-it + 清洗/增强在主线程开销 < 16ms 预算。 */
export const CHUNK_MAX_BYTES = 64 * 1024

/**
 * 把源文本切成自含的块（P1-1 分段渲染）。
 * - 按行累积，块边界取在「行末 + 非围栏/非块级公式内部」，保证：
 *   围栏代码块（```…```）与 $$…$$ 块级公式绝不会被切断；
 * - 块边界因此永远是行边界，且位于 fence/math 之外。
 */
export function splitChunks(src: string, maxBytes: number = CHUNK_MAX_BYTES): string[] {
  if (src.length <= maxBytes) {
    return src.length > 0 ? [src] : []
  }
  const chunks: string[] = []
  let chunk = ''
  let fence: 'code' | 'math' | null = null
  let lineStart = 0
  for (let i = 0; i <= src.length; i++) {
    if (i === src.length || src[i] === '\n') {
      if (i === src.length && lineStart >= src.length) break // 末尾无残留内容
      const line = src.slice(lineStart, i)
      if (fence === null) {
        if (/^```/.test(line)) fence = 'code'
        else if (/^\$\$/.test(line)) fence = 'math'
      } else if (fence === 'code') {
        if (/^```/.test(line)) fence = null
      } else if (fence === 'math') {
        if (/^\$\$/.test(line)) fence = null
      }
      chunk += line + '\n'
      if (fence === null && chunk.length >= maxBytes) {
        chunks.push(chunk)
        chunk = ''
      }
      lineStart = i + 1
    }
  }
  if (chunk.length > 0) {
    chunks.push(chunk)
  }
  return chunks
}

export interface RenderChunkCallbacks {
  /** 每完成一块（index 从 0 起，total 为总块数）。 */
  onChunk: (index: number, total: number, result: ChunkResult) => void
  /** 全部完成（renderMs 为渲染总耗时，totalWords 为累计字数）。 */
  onDone: (renderMs: number, totalWords: number, totalChunks: number) => void
  onError: (message: string) => void
}

export interface RenderChunkedJob {
  /** 渲染结束（done/error/cancel 均 resolve）后兑现。 */
  promise: Promise<void>
  cancel: () => void
}

/**
 * 分段渲染：优先 Web Worker（渲染不占主线程，UI 全程可交互）；
 * Worker 不可用（jsdom/降级）时回退到主线程 setTimeout 分片执行（同样渐进）。
 * 每块结果经 onChunk 逐块回报，调用方在 rAF 调度下插入 DOM 即实现渐进呈现。
 */
export function renderChunked(
  chunks: string[],
  opts: RenderOptions,
  callbacks: RenderChunkCallbacks,
): RenderChunkedJob {
  const idState = newHeadingIdState()
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    return renderChunkedInWorker(chunks, opts, callbacks, idState)
  }
  return renderChunkedFallback(chunks, opts, callbacks, idState)
}

/* ---------------- Web Worker 路径 ---------------- */

/** 并行渲染 Worker 数：桌面多核下把 markdown-it 总耗时近似减半。 */
const WORKER_COUNT = 2

function renderChunkedInWorker(
  chunks: string[],
  opts: RenderOptions,
  callbacks: RenderChunkCallbacks,
  idState: HeadingIdState,
): RenderChunkedJob {
  let cancelled = false
  let settled = false
  let resolveDone: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const t0 = performance.now()
  let totalWords = 0

  // 并行结果乱序到达：按全局 index 重组，保证 onChunk 按文档顺序产出
  const pending = new Map<number, string>()
  let nextIndex = 0
  let received = 0

  // 主线程逐块处理队列：每帧至多一块（rAF），避免消息洪泛造成主线程重新阻塞。
  const queue: { index: number; html: string }[] = []
  let processing = false
  const schedule = (fn: () => void): void => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fn)
    } else {
      setTimeout(fn, 0)
    }
  }
  const maybeDone = (): void => {
    if (!settled && received >= chunks.length && nextIndex >= chunks.length && queue.length === 0) {
      settled = true
      callbacks.onDone(Math.round(performance.now() - t0), totalWords, chunks.length)
      terminateWorkers()
      resolveDone()
    }
  }
  const drain = (): void => {
    if (cancelled || settled) return
    const item = queue.shift()
    if (!item) {
      processing = false
      maybeDone()
      return
    }
    const result = processChunk(item.html, chunks[item.index], opts, idState)
    totalWords += result.wordCount
    callbacks.onChunk(item.index, chunks.length, result)
    schedule(drain)
  }
  const flush = (): void => {
    while (pending.has(nextIndex)) {
      queue.push({ index: nextIndex, html: pending.get(nextIndex) as string })
      pending.delete(nextIndex)
      nextIndex++
    }
    if (!processing && queue.length > 0) {
      processing = true
      schedule(drain)
    } else {
      maybeDone()
    }
  }

  const workers = Array.from({ length: WORKER_COUNT }, () => {
    return new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })
  })
  const terminateWorkers = (): void => {
    for (const w of workers) {
      try {
        w.terminate()
      } catch {
        /* noop */
      }
    }
  }
  const fail = (message: string): void => {
    if (cancelled || settled) return
    settled = true
    callbacks.onError(message)
    terminateWorkers()
    resolveDone()
  }

  for (const w of workers) {
    w.onmessage = (e: MessageEvent) => {
      if (cancelled) return
      const msg = e.data as { type: string; index?: number; html?: string }
      if (msg.type === 'chunk' && typeof msg.html === 'string') {
        pending.set(msg.index ?? 0, msg.html)
        received++
        flush()
      } else if (msg.type === 'error') {
        fail(String(msg.html ?? '渲染进程错误'))
      }
    }
    w.onerror = (e) => fail('渲染进程错误：' + (e.message || 'unknown'))
  }

  // 平分任务：worker i 取全局 index ≡ i (mod WORKER_COUNT) 的分块
  workers.forEach((w, wi) => {
    const mine = chunks
      .map((text, index) => ({ index, text }))
      .filter((item) => item.index % WORKER_COUNT === wi)
    w.postMessage({ chunks: mine, katex: opts.katex })
  })

  return {
    promise,
    cancel: () => {
      cancelled = true
      if (!settled) {
        settled = true
        terminateWorkers()
        resolveDone()
      }
    },
  }
}

/* ---------------- 主线程回退路径（jsdom / 无 Worker 环境） ---------------- */

function renderChunkedFallback(
  chunks: string[],
  opts: RenderOptions,
  callbacks: RenderChunkCallbacks,
  idState: HeadingIdState,
): RenderChunkedJob {
  let cancelled = false
  let resolveDone: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  const t0 = performance.now()
  let i = 0
  let totalWords = 0

  const step = (): void => {
    if (cancelled) return
    if (i >= chunks.length) {
      callbacks.onDone(Math.round(performance.now() - t0), totalWords, chunks.length)
      resolveDone()
      return
    }
    // 单块体积小（≤64KB），同步处理后可让出主线程（渐进、不长期冻结）。
    // 用 1ms 延迟而非 0ms：肉眼无感，但保证每个 setTimeout 任务恰好处理一块
    //（0ms 链式定时器会在同一任务批次内连发，mock 计时无法逐块断言）。
    const result = processChunk(renderRaw(chunks[i], opts), chunks[i], opts, idState)
    totalWords += result.wordCount
    callbacks.onChunk(i, chunks.length, result)
    i++
    setTimeout(step, 1)
  }
  setTimeout(step, 1)

  return {
    promise,
    cancel: () => {
      cancelled = true
      resolveDone()
    },
  }
}
