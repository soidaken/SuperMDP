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
