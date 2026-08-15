import { ZOOM_OPTIONS, type Settings } from '../lib/settings'
import { previewFontFamily } from '../lib/fonts'

interface SettingsPopoverProps {
  open: boolean
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  onClose: () => void
  registerMsg: string | null
  onRegisterDefault: () => void
  systemFonts: string[]
  zoomMsg: string | null
  onZoomChange: (pct: number) => void
}

const FONT_LIST_ID = 'mdp-system-fonts'

/** 设置弹层（design-spec §6.6）：渲染开关 + 页面缩放 + 中英文字体 + 文件关联。 */
export function SettingsPopover({
  open,
  settings,
  onUpdate,
  onClose,
  registerMsg,
  onRegisterDefault,
  systemFonts,
  zoomMsg,
  onZoomChange,
}: SettingsPopoverProps) {
  const setFont = (kind: 'latin' | 'cjk', value: string) => {
    onUpdate({ fonts: { ...settings.fonts, [kind]: value.trim() || null } })
  }

  return (
    <div className={`mdp-popover${open ? ' open' : ''}`} role="dialog" aria-label="渲染设置">
      <datalist id={FONT_LIST_ID}>
        {systemFonts.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <p className="mdp-popover-title">渲染设置</p>
      <div className="mdp-popover-row">
        <span className="mdp-popover-label">
          数学公式 (KaTeX)
          <span className="mdp-popover-desc">$…$ 行内 · $$…$$ 块级</span>
        </span>
        <button
          type="button"
          className="mdp-switch"
          role="switch"
          aria-checked={settings.katex}
          aria-label="数学公式 KaTeX"
          onClick={() => {
            onUpdate({ katex: !settings.katex })
            onClose()
          }}
        />
      </div>
      <div className="mdp-popover-row">
        <span className="mdp-popover-label">
          图表 (mermaid)
          <span className="mdp-popover-desc">flowchart / sequence / gantt</span>
        </span>
        <button
          type="button"
          className="mdp-switch"
          role="switch"
          aria-checked={settings.mermaid}
          aria-label="图表 mermaid"
          onClick={() => {
            onUpdate({ mermaid: !settings.mermaid })
            onClose()
          }}
        />
      </div>

      <div className="mdp-popover-sep" />
      <p className="mdp-popover-title">页面缩放</p>
      <div className="mdp-seg" role="group" aria-label="页面缩放">
        {ZOOM_OPTIONS.map((pct) => (
          <button
            key={pct}
            type="button"
            className={`mdp-seg-btn${Math.round(settings.zoom * 100) === pct ? ' active' : ''}`}
            aria-pressed={Math.round(settings.zoom * 100) === pct}
            onClick={() => onZoomChange(pct)}
          >
            {pct}%
          </button>
        ))}
      </div>
      <p className="mdp-popover-msg">{zoomMsg ?? '系统级缩放，重启应用后生效'}</p>

      <div className="mdp-popover-sep" />
      <p className="mdp-popover-title">字体</p>
      <div className="mdp-font-row">
        <label className="mdp-popover-label" htmlFor="mdp-font-latin">
          英文字体
          <span className="mdp-popover-desc">输入名称筛选，留空用默认</span>
        </label>
        <input
          id="mdp-font-latin"
          className="mdp-font-input"
          type="text"
          list={FONT_LIST_ID}
          placeholder="内置: JetBrains Mono"
          value={settings.fonts.latin ?? ''}
          onChange={(e) => setFont('latin', e.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="mdp-font-row">
        <label className="mdp-popover-label" htmlFor="mdp-font-cjk">
          中文字体
          <span className="mdp-popover-desc">输入名称筛选，留空用默认</span>
        </label>
        <input
          id="mdp-font-cjk"
          className="mdp-font-input"
          type="text"
          list={FONT_LIST_ID}
          placeholder="内置: HarmonyOS Sans SC"
          value={settings.fonts.cjk ?? ''}
          onChange={(e) => setFont('cjk', e.target.value)}
          spellCheck={false}
        />
      </div>
      <p className="mdp-font-preview" style={{ fontFamily: previewFontFamily(settings.fonts) }}>
        The quick brown fox 0123 · 中文预览效果
      </p>

      <div className="mdp-popover-sep" />
      <p className="mdp-popover-title">文件关联</p>
      <button type="button" className="mdp-btn mdp-btn-block" onClick={onRegisterDefault}>
        设为 .md 默认打开程序
      </button>
      {registerMsg && <p className="mdp-popover-msg">{registerMsg}</p>}
    </div>
  )
}
