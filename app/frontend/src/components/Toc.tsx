import { useEffect, useRef } from 'react'
import type { Heading } from '../markdown/renderer'

interface TocProps {
  headings: Heading[]
  activeId: string | null
  onNavigate: (id: string) => void
}

/** 目录侧栏（design-spec §6.3）：扁平项 + .lvl-N 缩进，激活项滚动保持可见。 */
export function Toc({ headings, activeId, onNavigate }: TocProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // 激活项保持可见（scrollIntoView block:nearest 只滚动目录自身）
  useEffect(() => {
    if (!activeId) return
    const item = listRef.current?.querySelector<HTMLElement>(`.mdp-toc-item[data-id="${CSS.escape(activeId)}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  return (
    <nav className="mdp-toc" aria-label="目录">
      <div className="mdp-toc-title">目录</div>
      <div ref={listRef}>
        {headings.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`mdp-toc-item lvl-${h.level}${h.id === activeId ? ' active' : ''}`}
            data-id={h.id}
            title={h.text}
            onClick={() => onNavigate(h.id)}
          >
            {h.text}
          </button>
        ))}
      </div>
    </nav>
  )
}
