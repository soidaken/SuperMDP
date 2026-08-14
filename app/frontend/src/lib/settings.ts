export interface Settings {
  katex: boolean
  mermaid: boolean
}

export const SETTINGS_KEY = 'supermdp:settings'

const DEFAULTS: Settings = { katex: true, mermaid: true }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      katex: typeof parsed.katex === 'boolean' ? parsed.katex : DEFAULTS.katex,
      mermaid: typeof parsed.mermaid === 'boolean' ? parsed.mermaid : DEFAULTS.mermaid,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* 忽略写入失败 */
  }
}
