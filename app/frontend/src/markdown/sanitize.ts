import DOMPurify from 'dompurify'

/**
 * DOMPurify 清洗配置（design-spec 附录 A）：
 * - 放行 markdown-it-anchor 的 id 锚点（id 默认放行）
 * - 放行 markdown-it-task-lists 的 input[type=checkbox][disabled]
 * - 放行 KaTeX/mermaid 所需的 class / 内联 style / aria-* 属性
 * - ALLOW_DATA_ATTR:false 收紧 data-*（DOMPurify 默认放行）
 */
const BODY_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['input', 'annotation', 'semantics'],
  ADD_ATTR: [
    'disabled',
    'checked',
    'type',
    'role',
    'aria-hidden',
    'aria-label',
    'aria-describedby',
    'aria-labelledby',
    'aria-roledescription',
  ],
  ALLOW_DATA_ATTR: false,
}

/** 清洗 markdown-it 渲染出的正文 HTML。 */
export function sanitizeBody(html: string): string {
  return DOMPurify.sanitize(html, BODY_CONFIG)
}

/**
 * P2-1：收紧 style 属性值（纵深防御）。
 * DOMPurify 白名单放行 style（KaTeX/mermaid 需要），但其默认 CSS 清洗
 * 不剔除 url(javascript:) / expression() / @import / behavior: 形态。
 * 命中任一危险形态即整条移除 style 属性——KaTeX/mermaid 的正常样式
 * （min-width/min-height/color 等）不含这些形态，不受影响。
 */
const DANGEROUS_STYLE = /(url\s*\(\s*['"]?\s*javascript\s*:|expression\s*\(|@import|behavior\s*:)/i

DOMPurify.addHook('beforeSanitizeAttributes', (node: Element) => {
  if (node.hasAttribute?.('style')) {
    const style = node.getAttribute('style') ?? ''
    if (DANGEROUS_STYLE.test(style)) {
      node.removeAttribute('style')
    }
  }
})

/**
 * 清洗 mermaid 生成的 SVG（svg profile 二次清洗）。
 * mermaid 将样式内联在 <svg> 内的 <style> 中，需放行 style 标签，
 * 否则图表会失去样式。securityLevel 仍为 strict，此处是纵深防御。
 */
const SVG_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['style'],
  ADD_ATTR: [
    'aria-hidden',
    'aria-label',
    'aria-describedby',
    'aria-roledescription',
  ],
  ALLOW_DATA_ATTR: false,
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, SVG_CONFIG)
}
