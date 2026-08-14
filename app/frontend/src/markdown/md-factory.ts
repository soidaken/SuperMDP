import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import texmath from 'markdown-it-texmath'
import hljs from 'highlight.js/lib/common'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import powershell from 'highlight.js/lib/languages/powershell'
import katex from 'katex'

/**
 * P2-3：highlight.js/lib/common 未注册 dockerfile / powershell
 * （checklist C-1 明确列举），补注册（两模块随包提供，约 +10KB）。
 */
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('powershell', powershell)

export interface RenderOptions {
  /** 启用 KaTeX（$...$ / $$...$$）。关闭时公式按原文显示。 */
  katex: boolean
  /** 启用 mermaid 图表。关闭时图表按代码块显示。 */
  mermaid: boolean
}

export interface Heading {
  level: number
  id: string
  text: string
}

/** GitHub 风格 slug：小写、空白转连字符、保留 CJK 与字母数字。 */
export function slugify(s: string): string {
  const slug = s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'section'
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 构建 markdown-it 实例（KaTeX 开/关）。
 * 纯 JS/字符串管道，无 DOM 依赖 —— 可安全运行于 Web Worker（render.worker.ts）。
 * markdown-it v15 的 default 导出为 class+namespace 合并，实例类型请用推断。
 */
export function createMd(withKatex: boolean) {
  const instance = new MarkdownIt({
    html: true, // 放行原始 HTML，由 DOMPurify 在渲染后兜底清洗
    linkify: true,
    breaks: false, // 遵循 CommonMark：行尾两空格才软换行
    highlight(code: string, lang: string): string {
      // highlight 返回的内容会被 markdown-it 包进 <pre><code>，
      // 代码块头部（语言标签 + 复制按钮）在 enhanceCodeBlocks 中统一生成。
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        } catch {
          // 高亮失败按纯文本处理
        }
      }
      return instance.utils.escapeHtml(code)
    },
  })

  instance.use(anchor, {
    level: [1, 2, 3, 4, 5, 6],
    slugify,
    tabIndex: false,
    permalink: anchor.permalink.headerLink({
      symbol: '#',
      safariReaderFix: true,
    }),
  })

  // enabled:false → 复选框带 disabled=""（只读预览不可交互，spec §6.8）
  instance.use(taskLists, { enabled: false, label: false })

  instance.use(footnote)

  if (withKatex) {
    instance.use(texmath, {
      engine: katex,
      delimiters: 'dollars',
      katexOptions: { throwOnError: false, strict: false },
    })
  }
  return instance
}
