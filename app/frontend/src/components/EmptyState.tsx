/** 空状态（design-spec §6.4）：56px SVG + 主文案 + 拖拽/快捷键提示。 */
export function EmptyState() {
  return (
    <div className="mdp-empty">
      <svg
        className="mdp-empty-icon"
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
      <div className="mdp-empty-title">打开一个 Markdown 文件</div>
      <div className="mdp-empty-hint">
        将文件拖入窗口 或 按 <kbd className="mdp-kbd">Ctrl+O</kbd> 打开
      </div>
    </div>
  )
}
