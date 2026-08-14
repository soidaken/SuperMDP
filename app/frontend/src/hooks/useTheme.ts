import { useCallback, useEffect, useState } from 'react'
import { applyTheme, getCurrentTheme, persistTheme, type Theme } from '../lib/theme'

/**
 * 主题状态：
 * - 默认浅色，不跟随系统主题（design 决策，用户手动切换后持久化）
 * - 初始值来自 index.html 内联脚本写入的 data-theme（首帧前，无闪烁）
 * - 点击切换：更新 data-theme + 写 localStorage
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
    // 兜底：若内联脚本未执行（极端情况），此处补一次（默认浅色）
    if (!document.documentElement.getAttribute('data-theme')) {
      applyTheme(getCurrentTheme())
    }
  }, [])

  return { theme, toggleTheme }
}
