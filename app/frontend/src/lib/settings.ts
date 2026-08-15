export interface Fonts {
  /** 英文字体（拉丁字符优先），null = 使用默认栈 */
  latin: string | null
  /** 中文字体（CJK 字符优先），null = 使用默认栈 */
  cjk: string | null
}

export interface Settings {
  katex: boolean
  mermaid: boolean
  fonts: Fonts
  /** 页面级缩放系数（100%=1，125%=1.25…） */
  zoom: number
}

export const SETTINGS_KEY = 'supermdp:settings'

/** 可选页面缩放档位（百分比） */
export const ZOOM_OPTIONS = [100, 125, 150] as const

/** 默认页面缩放：125% */
export const DEFAULT_ZOOM = 1.25

const DEFAULTS: Settings = {
  katex: true,
  mermaid: true,
  fonts: { latin: null, cjk: null },
  zoom: DEFAULT_ZOOM,
}

function parseFontName(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS, fonts: { ...DEFAULTS.fonts } }
    const parsed = JSON.parse(raw) as Partial<Settings>
    const fonts = (parsed.fonts ?? {}) as Partial<Fonts>
    const zoom = typeof parsed.zoom === 'number' && parsed.zoom > 0 ? parsed.zoom : DEFAULT_ZOOM
    return {
      katex: typeof parsed.katex === 'boolean' ? parsed.katex : DEFAULTS.katex,
      mermaid: typeof parsed.mermaid === 'boolean' ? parsed.mermaid : DEFAULTS.mermaid,
      fonts: {
        latin: parseFontName(fonts.latin),
        cjk: parseFontName(fonts.cjk),
      },
      zoom,
    }
  } catch {
    return { ...DEFAULTS, fonts: { ...DEFAULTS.fonts } }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* 忽略写入失败 */
  }
}
