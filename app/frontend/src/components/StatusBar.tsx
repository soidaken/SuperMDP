import { formatSize, formatWordCount } from '../lib/format'

interface StatusBarProps {
  fileName: string | null
  fileSize: number | null
  encoding: string | null
  wordCount: number | null
  renderMs: number | null
  loading: boolean
  rendering: boolean
  progress: number
  notice: string | null
  danger: string | null
}

/** 状态栏（design-spec §5.2）：文件名 · 大小 · 字数 · 渲染耗时 | Ctrl+O；渲染中显示进度。 */
export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="mdp-statusbar">
      {props.danger ? (
        <span className="mdp-statusbar-item" style={{ color: 'var(--mdp-danger)' }}>
          {props.danger}
        </span>
      ) : props.notice ? (
        <span className="mdp-statusbar-item" style={{ color: 'var(--mdp-danger)' }}>
          {props.notice}
        </span>
      ) : props.loading ? (
        <span className="mdp-statusbar-item">加载中…</span>
      ) : props.rendering ? (
        <span className="mdp-statusbar-item">渲染中 {props.progress}%</span>
      ) : (
        <>
          {props.fileName && (
            <span className="mdp-statusbar-item mdp-statusbar-filename" title={props.fileName}>
              {props.fileName}
            </span>
          )}
          {props.fileSize !== null && (
            <span className="mdp-statusbar-item">{formatSize(props.fileSize)}</span>
          )}
          {props.encoding && props.encoding !== 'utf-8' && (
            <span className="mdp-statusbar-item">{props.encoding.toUpperCase()}</span>
          )}
          {props.wordCount !== null && (
            <span className="mdp-statusbar-item">{formatWordCount(props.wordCount)}</span>
          )}
          {props.renderMs !== null && (
            <span className="mdp-statusbar-item">{props.renderMs} ms</span>
          )}
        </>
      )}
      <span className="mdp-statusbar-spacer" />
      <span className="mdp-statusbar-item">
        <kbd className="mdp-kbd">Ctrl+O</kbd>&nbsp;打开
      </span>
    </footer>
  )
}
