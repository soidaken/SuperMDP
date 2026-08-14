import { sanitizeSvg } from './sanitize'
import { escapeHtml } from './renderer'

let seq = 0

export interface MermaidSource {
  id: string
  source: string
}

export interface MermaidEnhanceResult {
  /** 渲染后的完整 HTML（svg 已清洗并嵌入） */
  html: string
  /** 本次参与渲染的图表源码（供将来按 id 复用/重渲） */
  sources: MermaidSource[]
}

/**
 * mermaid 渲染（懒加载）：把 html 中所有 code.language-mermaid 替换为
 * 清洗过的 <div class="mermaid">svg</div>。
 * - 字符串级（detached DOM）处理：React 无 DOM 冲突，StrictMode 安全，
 *   主题切换时可从原始 html 重新渲染。
 * - 渲染失败：降级为带语言标签的源码代码块 + onError 状态栏提示。
 */
export async function enhanceMermaid(
  html: string,
  theme: 'light' | 'dark',
  onError: (message: string) => void,
): Promise<MermaidEnhanceResult> {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const blocks = Array.from(tmp.querySelectorAll('code.language-mermaid'))
  if (blocks.length === 0) return { html, sources: [] }

  let mermaid: typeof import('mermaid').default
  try {
    mermaid = (await import('mermaid')).default
  } catch {
    onError('mermaid 加载失败，图表以源码显示')
    return { html, sources: [] }
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict', // mermaid 自带清洗，SVG 输出后仍做一次 DOMPurify 清洗
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
  })

  const sources: MermaidSource[] = []
  for (const code of blocks) {
    const source = code.textContent ?? ''
    const id = `mmd-${Date.now().toString(36)}-${++seq}`
    sources.push({ id, source })
    const pre = code.parentElement
    try {
      const { svg } = await mermaid.render(id, source)
      const wrap = document.createElement('div')
      wrap.className = 'mermaid'
      wrap.innerHTML = sanitizeSvg(svg)
      pre?.replaceWith(wrap)
    } catch {
      // 降级：显示源码
      const fallback = document.createElement('pre')
      fallback.className = 'mdp-code-block'
      fallback.innerHTML =
        `<div class="mdp-code-header"><span class="mdp-code-lang">mermaid</span></div>` +
        `<code class="language-mermaid">${escapeHtml(source)}</code>`
      pre?.replaceWith(fallback)
      onError('mermaid 图表渲染失败，已降级为源码')
    }
  }
  return { html: tmp.innerHTML, sources }
}
