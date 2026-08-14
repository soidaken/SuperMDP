import type { ReactNode, RefObject } from 'react'

interface ToolbarProps {
  onOpen: () => void
  onRefresh: () => void
  canRefresh: boolean
  tocActive: boolean
  onToggleToc: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  settingsAnchorRef: RefObject<HTMLSpanElement | null>
  settingsPopover: ReactNode
}

/**
 * 工具栏（design-spec §5.2 / §6.1）：
 * 应用名 · 打开[主] · 刷新 | spacer | 目录 · 主题 · 设置(弹层锚点)
 */
export function Toolbar(props: ToolbarProps) {
  return (
    <header className="mdp-toolbar">
      <span className="mdp-appname">SuperMDP</span>
      <button type="button" className="mdp-btn mdp-btn-primary" onClick={props.onOpen}>
        <svg
          className="mdp-icon"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
        打开
      </button>
      <button
        type="button"
        className="mdp-icon-btn"
        title="重新渲染 (Ctrl+R)"
        aria-label="重新渲染"
        disabled={!props.canRefresh}
        onClick={props.onRefresh}
      >
        <svg
          className="mdp-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 11A8 8 0 1 0 18.4 16" />
          <path d="M20 5v6h-6" />
        </svg>
      </button>
      <span className="mdp-toolbar-sep" />
      <span className="mdp-toolbar-spacer" />
      <ToolbarIconBtn
        active={props.tocActive}
        title="目录 (Ctrl+1)"
        label="显示或隐藏目录"
        onClick={props.onToggleToc}
      >
        <path d="M4 6h16M4 12h10M4 18h16" />
      </ToolbarIconBtn>
      <ToolbarIconBtn
        title="切换明暗主题 (Ctrl+T)"
        label="切换主题"
        onClick={props.onToggleTheme}
      >
        {props.theme === 'dark' ? (
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </ToolbarIconBtn>
      <span className="mdp-popover-anchor" ref={props.settingsAnchorRef}>
        <ToolbarIconBtn
          active={props.settingsOpen}
          title="渲染设置"
          label="渲染设置"
          onClick={props.onToggleSettings}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
        </ToolbarIconBtn>
        {props.settingsPopover}
      </span>
    </header>
  )
}

function ToolbarIconBtn({
  children,
  onClick,
  title,
  label,
  active = false,
}: {
  children: ReactNode
  onClick: () => void
  title: string
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`mdp-icon-btn${active ? ' active' : ''}`}
      title={title}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <svg
        className="mdp-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  )
}
