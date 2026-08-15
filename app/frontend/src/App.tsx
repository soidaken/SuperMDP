import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Toolbar } from './components/Toolbar'
import { Toc } from './components/Toc'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { DragOverlay } from './components/DragOverlay'
import { SettingsPopover } from './components/SettingsPopover'
import { splitChunks, renderChunked } from './markdown/chunk'
import type { Heading } from './markdown/md-factory'
import { renderMermaidInContainer, type MermaidSource } from './markdown/mermaid'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'
import { useFile } from './hooks/useFile'
import { isMarkdownPath } from './lib/format'
import { applyFonts } from './lib/fonts'
import { GetStartupFile, GetSystemFonts, RegisterAssociations, SetZoomPref } from '../wailsjs/go/main/App'
import { BrowserOpenURL, OnFileDrop, OnFileDropOff } from '../wailsjs/runtime'

type RenderState = 'idle' | 'rendering' | 'done' | 'error'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { settings, update: updateSettings } = useSettings()
  const file = useFile()

  const [tocOpen, setTocOpen] = useState(true)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [dropDanger, setDropDanger] = useState<string | null>(null)
  const [mermaidMsg, setMermaidMsg] = useState<string | null>(null)

  const [renderState, setRenderState] = useState<RenderState>('idle')
  const [progress, setProgress] = useState(0)
  const [tocHeadings, setTocHeadings] = useState<Heading[]>([])
  const [wordCount, setWordCount] = useState(0)
  const [renderMs, setRenderMs] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [registerMsg, setRegisterMsg] = useState<string | null>(null)
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const [zoomMsg, setZoomMsg] = useState<string | null>(null)

  /* ---------- 字体设置：加载系统字体列表 + 应用所选字体（中/英） ---------- */
  useEffect(() => {
    applyFonts(settings.fonts)
  }, [settings.fonts])

  useEffect(() => {
    let cancelled = false
    GetSystemFonts()
      .then((fonts) => {
        if (!cancelled) setSystemFonts(fonts)
      })
      .catch(() => {
        /* 开发模式无 runtime 时忽略 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const contentScrollRef = useRef<HTMLDivElement>(null)
  const contentBodyRef = useRef<HTMLDivElement>(null)
  const settingsAnchorRef = useRef<HTMLSpanElement>(null)
  const renderGen = useRef(0)
  const mermaidBusy = useRef(false)
  const mermaidSources = useRef<MermaidSource[]>([])

  /* ---------- 分段渲染（P1-1）：Worker 渲染不占主线程，逐块 rAF 插入，渐进呈现 ---------- */
  useEffect(() => {
    const body = contentBodyRef.current
    if (!file.doc) {
      setRenderState('idle')
      setProgress(0)
      setTocHeadings([])
      setWordCount(0)
      setRenderMs(null)
      setActiveId(null)
      mermaidSources.current = []
      return
    }
    const gen = ++renderGen.current
    setRenderState('rendering')
    setProgress(0)
    setTocHeadings([])
    setWordCount(0)
    setRenderMs(null)
    setActiveId(null)
    mermaidSources.current = []
    if (body) body.innerHTML = '' // 渐进插入模式下 DOM 由渲染循环管理

    const chunks = splitChunks(file.doc.content)
    const accHeadings: Heading[] = []
    let accWords = 0

    const job = renderChunked(
      chunks,
      { katex: settings.katex, mermaid: settings.mermaid },
      {
        onChunk: (index, total, result) => {
          if (gen !== renderGen.current) return
          accHeadings.push(...result.headings)
          accWords += result.wordCount
          // 调度器保证每帧至多一块：渐进插入，不阻塞滚动/主题切换
          contentBodyRef.current?.insertAdjacentHTML('beforeend', result.html)
          setTocHeadings([...accHeadings])
          setWordCount(accWords)
          setProgress(Math.round(((index + 1) / total) * 100))
        },
        onDone: (ms, words) => {
          if (gen !== renderGen.current) return
          setRenderMs(ms)
          setWordCount(words)
          setProgress(100)
          setRenderState('done')
        },
        onError: (msg) => {
          if (gen !== renderGen.current) return
          setRenderState('error')
          setMermaidMsg(msg)
        },
      },
    )
    return () => job.cancel()
  }, [file.doc, settings.katex, settings.mermaid])

  /* ---------- mermaid：懒加载，容器版渲染；主题切换用缓存源码重渲 ---------- */
  useEffect(() => {
    const body = contentBodyRef.current
    if (renderState !== 'done' || !settings.mermaid || !body) return
    if (mermaidBusy.current) return // StrictMode 双跑防护
    mermaidBusy.current = true
    const token = ++renderGen.current // 复用 renderGen 作为 mermaid 世代
    void renderMermaidInContainer(
      body,
      theme,
      mermaidSources.current.length > 0 ? mermaidSources.current : null,
      (msg) => {
        if (token === renderGen.current) setMermaidMsg(msg)
      },
    )
      .then((res) => {
        mermaidBusy.current = false
        if (token === renderGen.current) mermaidSources.current = res.sources
      })
      .catch(() => {
        mermaidBusy.current = false
      })
  }, [renderState, settings.mermaid, theme])

  /* ---------- 目录滚动跟随（rAF 节流，§7.4） ---------- */
  useEffect(() => {
    const el = contentScrollRef.current
    if (!el || tocHeadings.length === 0) return
    let raf = 0
    const update = () => {
      raf = 0
      const containerTop = el.getBoundingClientRect().top
      let current: string | null = null
      for (const h of tocHeadings) {
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
  }, [tocHeadings])

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

  /* ---------- 启动时打开命令行传入的文件（注册为 .md 默认打开程序后，双击即进入此路径） ---------- */
  useEffect(() => {
    let cancelled = false
    GetStartupFile()
      .then((p) => {
        if (!cancelled && p) void file.openPath(p)
      })
      .catch(() => {
        /* 开发模式无 runtime 时忽略 */
      })
    return () => {
      cancelled = true
    }
  }, [file.openPath])

  /* ---------- 设为 .md 默认打开程序（设置弹层按钮） ---------- */
  const handleRegisterDefault = useCallback(async () => {
    try {
      // wails 多返回值（bool, string）在运行时以数组返回，d.ts 生成为联合类型
      const result = (await RegisterAssociations()) as unknown as [boolean, string]
      setRegisterMsg(result[1])
    } catch (err) {
      setRegisterMsg(String(err))
    }
  }, [])

  /* ---------- 页面缩放：写入系统配置，重启后生效（WebView2 ZoomFactor） ---------- */
  const handleZoomChange = useCallback(
    async (pct: number) => {
      try {
        await SetZoomPref(pct)
        updateSettings({ zoom: pct / 100 })
        setZoomMsg(`已保存，缩放 ${pct}% 将在重启应用后生效`)
      } catch (err) {
        setZoomMsg(String(err))
      }
    },
    [updateSettings],
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

  const hasToc = !!file.doc && tocHeadings.length > 0
  const statusDanger = file.danger ?? dropDanger ?? mermaidMsg
  const showPlaceholder = renderState === 'rendering' && progress === 0

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
            registerMsg={registerMsg}
            onRegisterDefault={() => void handleRegisterDefault()}
            systemFonts={systemFonts}
            zoomMsg={zoomMsg}
            onZoomChange={(pct) => void handleZoomChange(pct)}
          />
        }
      />
      <div className={`mdp-main${!tocOpen || !hasToc ? ' toc-collapsed' : ''}`}>
        {hasToc && <Toc headings={tocHeadings} activeId={activeId} onNavigate={navigateTo} />}
        <div ref={contentScrollRef} className="mdp-content">
          {file.doc ? (
            <>
              {showPlaceholder && <div className="mdp-render-progress">渲染中… 0%</div>}
              <div
                ref={contentBodyRef}
                className="mdp-content-body"
                onClick={handleContentClick}
              />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
      <StatusBar
        fileName={file.doc?.fileName ?? null}
        fileSize={file.doc?.fileSize ?? null}
        encoding={file.doc?.encoding ?? null}
        wordCount={wordCount}
        renderMs={renderMs}
        loading={file.loading}
        rendering={renderState === 'rendering'}
        progress={progress}
        notice={file.notice}
        danger={statusDanger}
      />
      <DragOverlay visible={overlayVisible} />
    </div>
  )
}
