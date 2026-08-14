import { useCallback, useState } from 'react'
import { loadSettings, saveSettings, type Settings } from '../lib/settings'

/** 渲染设置（KaTeX / mermaid 开关），持久化到 localStorage，即时生效。 */
export function useSettings(): {
  settings: Settings
  update: (patch: Partial<Settings>) => void
} {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, update }
}
