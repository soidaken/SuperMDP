import type { Fonts } from './settings'

/**
 * 字体设置应用：把用户选择的中/英文字体写入根元素 CSS 变量，
 * ui.css 的 --mdp-font-sans 通过 var() 引用，即时生效。
 */
export function applyFonts(fonts: Fonts): void {
  const root = document.documentElement
  if (fonts.latin) {
    root.style.setProperty('--mdp-font-latin', `"${fonts.latin}"`)
  } else {
    root.style.removeProperty('--mdp-font-latin')
  }
  if (fonts.cjk) {
    root.style.setProperty('--mdp-font-cjk', `"${fonts.cjk}"`)
  } else {
    root.style.removeProperty('--mdp-font-cjk')
  }
}

/** 预览用 font-family（缺省时回退到默认栈）。 */
export function previewFontFamily(fonts: Fonts): string {
  const parts = [fonts.latin ? `"${fonts.latin}"` : '', fonts.cjk ? `"${fonts.cjk}"` : ''].filter(Boolean)
  return parts.length > 0 ? `${parts.join(', ')}, sans-serif` : 'sans-serif'
}
