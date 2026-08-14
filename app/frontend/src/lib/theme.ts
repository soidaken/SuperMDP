export type Theme = 'light' | 'dark'

export const THEME_KEY = 'supermdp:theme'

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 读取当前生效主题（index.html 内联脚本已在首帧前写入 data-theme）。 */
export function getCurrentTheme(): Theme {
  const v = document.documentElement.getAttribute('data-theme')
  return v === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* localStorage 不可用时仅内存生效 */
  }
}

export function hasStoredTheme(): boolean {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark'
  } catch {
    return false
  }
}
