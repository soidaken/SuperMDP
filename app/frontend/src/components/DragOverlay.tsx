/** 拖拽遮罩（design-spec §6.5）：显示/隐藏由 .hidden 类控制。 */
export function DragOverlay({ visible }: { visible: boolean }) {
  return (
    <div className={`mdp-overlay${visible ? '' : ' hidden'}`} aria-hidden={!visible}>
      <div className="mdp-overlay-body">
        <svg
          className="mdp-overlay-icon"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12M7 10l5 5 5-5" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="mdp-overlay-text">释放以打开文件</span>
      </div>
    </div>
  )
}
