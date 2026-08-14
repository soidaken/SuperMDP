import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  getCurrentTheme,
  getSystemTheme,
  hasStoredTheme,
  persistTheme,
  type Theme,
} from '../lib/theme'

/**
 * 主题状态（design-spec §7.1）：
 * - 初始值来自 index.html 内联脚本写入的 data-theme（首帧前，无闪烁）
 * - 点击切换：更新 data-theme + 写 localStorage
 * - 系统主题变化：仅在用户未手动选择过时跟随
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => getCurrentTheme())

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      persistTheme(next)
      return next
    })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (hasStoredTheme()) return // 用户已手动选择，不再跟随系统
      const next: Theme = e.matches ? 'dark' : 'light'
      applyTheme(next)
      setTheme(next)
    }
    mq.addEventListener('change', onChange)
    // 兜底：若内联脚本未执行（极端情况），此处补一次
    if (!document.documentElement.getAttribute('data-theme')) {
      applyTheme(hasStoredTheme() ? getCurrentTheme() : getSystemTheme())
    }
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return { theme, toggleTheme }
}
