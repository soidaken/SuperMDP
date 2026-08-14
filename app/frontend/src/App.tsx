import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Toolbar } from './components/Toolbar'
import { Toc } from './components/Toc'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { DragOverlay } from './components/DragOverlay'
import { SettingsPopover } from './components/SettingsPopover'
import { renderMarkdown, type RenderResult } from './markdown/renderer'
import { enhanceMermaid } from './markdown/mermaid'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'
import { useFile } from './hooks/useFile'
import { isMarkdownPath } from './lib/format'
import { BrowserOpenURL, OnFileDrop, OnFileDropOff } from '../wailsjs/runtime'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { settings, update: updateSettings } = useSettings()
  const file = useFile()

  const [tocOpen, setTocOpen] = useState(true)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [dropDanger, setDropDanger] = useState<string | null>(null)
  const [mermaidMsg, setMermaidMsg] = useState<string | null>(null)

  const [render, setRender] = useState<RenderResult | null>(null)
  const [mermaidHtml, setMermaidHtml] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const contentScrollRef = useRef<HTMLDivElement>(null)
  const settingsAnchorRef = useRef<HTMLSpanElement>(null)
  const renderGen = useRef(0)
  const mermaidToken = useRef(0)

  /* ---------- 渲染：大文件不阻塞 UI（requestIdleCallback / setTimeout 调度） ---------- */
  useEffect(() => {
    if (!file.doc) {
      setRender(null)
      setActiveId(null)
      return
    }
    const gen = ++renderGen.current
    const content = file.doc.content
    const run = () => {
      if (gen !== renderGen.current) return
      const result = renderMarkdown(content, {
        katex: settings.katex,
        mermaid: settings.mermaid,
      })
      if (gen !== renderGen.current) return
      setRender(result)
      setActiveId(null)
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 300 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(run, 0)
    return () => window.clearTimeout(id)
  }, [file.doc, settings.katex, settings.mermaid])

  /* ---------- mermaid：懒加载 + 字符串级渲染（可随主题重渲，StrictMode 安全） ---------- */
  useEffect(() => {
    if (!render || !settings.mermaid) {
      setMermaidHtml(null)
      return
    }
    const token = ++mermaidToken.current
    const baseHtml = render.html
    void enhanceMermaid(baseHtml, theme, (msg) => {
      if (token === mermaidToken.current) setMermaidMsg(msg)
    }).then((res) => {
      if (token !== mermaidToken.current) return
      setMermaidHtml(res.html)
    })
  }, [render, settings.mermaid, theme])

  const displayHtml = mermaidHtml ?? render?.html ?? null

  /* ---------- 目录滚动跟随（rAF 节流，§7.4） ---------- */
  useEffect(() => {
    const el = contentScrollRef.current
    if (!el || !render) return
    let raf = 0
    const update = () => {
      raf = 0
      const containerTop = el.getBoundingClientRect().top
      let current: string | null = null
      for (const h of render.headings) {
        const node = document.getElementById(h.id)
        if (!node) continue
        if (node.getBoundingClientRect().top - containerTop <= 96) current = h.id
        else break
      }
      setActiveId((prev) => (prev === current ? prev : current))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const raf0 = requestAnimationFrame(update)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      cancelAnimationFrame(raf0)
      el.removeEventListener('scroll', onScroll)
    }
  }, [render])

  const navigateTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /* ---------- 正文点击：复制按钮 / 外链（系统浏览器打开） ---------- */
  const handleCopy = useCallback(async (btn: HTMLButtonElement) => {
    const header = btn.closest('.mdp-code-header')
    const code = header?.nextElementSibling
    const text = code?.textContent ?? ''
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    if (!ok) return
    btn.textContent = '已复制'
    btn.classList.add('copied')
    window.setTimeout(() => {
      btn.textContent = '复制'
      btn.classList.remove('copied')
    }, 1600)
  }, [])

  const handleContentClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      const copyBtn = target.closest<HTMLButtonElement>('.mdp-copy-btn')
      if (copyBtn) {
        e.preventDefault()
        void handleCopy(copyBtn)
        return
      }
      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (link) {
        const href = link.getAttribute('href') ?? ''
        if (/^(https?:|mailto:)/i.test(href)) {
          e.preventDefault()
          BrowserOpenURL(href)
        }
      }
    },
    [handleCopy],
  )

  /* ---------- 拖拽打开（§7.3）：HTML5 事件控制遮罩；Wails 原生 OnFileDrop 取路径 ---------- */
  useEffect(() => {
    let depth = 0
    const lastDrop = { t: 0 }
    const openDropped = (path: string | undefined) => {
      if (!path) return
      if (Date.now() - lastDrop.t < 800) return // 双通道去重
      lastDrop.t = Date.now()
      if (isMarkdownPath(path)) {
        void file.openPath(path)
      } else {
        setDropDanger('不支持的文件类型')
      }
    }
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setOverlayVisible(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOverlayVisible(false)
    }
    const onDropHtml = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setOverlayVisible(false)
      const f = e.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined
      openDropped(f?.path)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDropHtml)
    try {
      // 生产（WebView2）下 Wails 拦截了 HTML5 drop，走原生回调拿路径
      OnFileDrop((_x, _y, paths) => openDropped(paths[0]), false)
    } catch {
      /* 浏览器开发模式无 wails runtime */
    }
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDropHtml)
      try {
        OnFileDropOff()
      } catch {
        /* noop */
      }
    }
  }, [file.openPath])

  /* 拖拽错误提示 4s 后自动消失 */
  useEffect(() => {
    if (!dropDanger) return
    const id = window.setTimeout(() => setDropDanger(null), 4000)
    return () => window.clearTimeout(id)
  }, [dropDanger])

  /* ---------- 快捷键（§7.5）与弹层关闭 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'o') {
        e.preventDefault()
        void file.open()
      } else if ((mod && key === 'r') || e.key === 'F5') {
        e.preventDefault() // F5 默认会刷新 WebView2
        void file.reload()
      } else if (mod && key === 't') {
        e.preventDefault()
        toggleTheme()
      } else if (mod && key === '1') {
        e.preventDefault()
        setTocOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setPopoverOpen(false)
        setOverlayVisible(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file.open, file.reload, toggleTheme])

  /* 设置弹层：点击外部关闭 */
  useEffect(() => {
    if (!popoverOpen) return
    const onDown = (e: MouseEvent) => {
      const el = settingsAnchorRef.current
      if (el && !el.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [popoverOpen])

  const hasToc = !!file.doc && !!render && render.headings.length > 0
  const statusDanger = file.danger ?? dropDanger ?? mermaidMsg

  return (
    <div className="mdp-app">
      <Toolbar
        onOpen={() => void file.open()}
        onRefresh={() => void file.reload()}
        canRefresh={!!file.doc && !file.loading}
        tocActive={tocOpen}
        onToggleToc={() => setTocOpen((v) => !v)}
        theme={theme}
        onToggleTheme={toggleTheme}
        settingsOpen={popoverOpen}
        onToggleSettings={() => setPopoverOpen((v) => !v)}
        settingsAnchorRef={settingsAnchorRef}
        settingsPopover={
          <SettingsPopover
            open={popoverOpen}
            settings={settings}
            onUpdate={updateSettings}
            onClose={() => setPopoverOpen(false)}
          />
        }
      />
      <div className={`mdp-main${!tocOpen || !hasToc ? ' toc-collapsed' : ''}`}>
        {hasToc && (
          <Toc headings={render!.headings} activeId={activeId} onNavigate={navigateTo} />
        )}
        <div ref={contentScrollRef} className="mdp-content">
          {render && displayHtml ? (
            <div
              className="mdp-content-body"
              dangerouslySetInnerHTML={{ __html: displayHtml }}
              onClick={handleContentClick}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
      <StatusBar
        fileName={file.doc?.fileName ?? null}
        fileSize={file.doc?.fileSize ?? null}
        encoding={file.doc?.encoding ?? null}
        wordCount={render?.wordCount ?? null}
        renderMs={render?.renderMs ?? null}
        loading={file.loading}
        notice={file.notice}
        danger={statusDanger}
      />
      <DragOverlay visible={overlayVisible} />
    </div>
  )
}
