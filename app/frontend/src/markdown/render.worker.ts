/**
 * 渲染 Worker（P1-1）：在后台线程执行 markdown-it + hljs + katex 纯字符串管道。
 * 无 DOM 依赖（md-factory 仅依赖纯 JS 库），每个分块渲染后立即回报主线程，
 * 由主线程逐块清洗/增强/插入 —— 大文件渲染期间 UI 保持可交互。
 * 支持并行分派：接收带全局 index 的分块，回报时原样带回。
 */
import { createMd } from './md-factory'

const mdWithKatex = createMd(true)
const mdWithoutKatex = createMd(false)

interface WorkerScope {
  onmessage: ((e: MessageEvent) => void) | null
  postMessage: (msg: unknown) => void
}

const scope = self as unknown as WorkerScope

interface RenderChunkItem {
  index: number
  text: string
}

interface RenderRequest {
  chunks?: RenderChunkItem[]
  katex?: boolean
}

scope.onmessage = (e: MessageEvent) => {
  const data = (e.data ?? {}) as RenderRequest
  const chunks = data.chunks ?? []
  const md = data.katex === false ? mdWithoutKatex : mdWithKatex
  try {
    for (const c of chunks) {
      scope.postMessage({
        type: 'chunk',
        index: c.index,
        total: chunks.length,
        html: md.render(c.text),
      })
    }
    scope.postMessage({ type: 'done', total: chunks.length })
  } catch (err) {
    scope.postMessage({ type: 'error', html: err instanceof Error ? err.message : String(err) })
  }
}
