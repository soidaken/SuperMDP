import type { Settings } from '../lib/settings'

interface SettingsPopoverProps {
  open: boolean
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  onClose: () => void
  registerMsg: string | null
  onRegisterDefault: () => void
}

/** 设置弹层（design-spec §6.6）：KaTeX / mermaid 开关 + 文件关联，即时生效并持久化。 */
export function SettingsPopover({
  open,
  settings,
  onUpdate,
  onClose,
  registerMsg,
  onRegisterDefault,
}: SettingsPopoverProps) {
  return (
    <div className={`mdp-popover${open ? ' open' : ''}`} role="dialog" aria-label="渲染设置">
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
      <p className="mdp-popover-title">文件关联</p>
      <button type="button" className="mdp-btn mdp-btn-block" onClick={onRegisterDefault}>
        设为 .md 默认打开程序
      </button>
      {registerMsg && <p className="mdp-popover-msg">{registerMsg}</p>}
    </div>
  )
}
