import { useCallback, useEffect, useRef, useState } from 'react'
import { GetFileInfo, OpenFileDialog, ReadFile, WatchFile } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime'
import type { main } from '../../wailsjs/go/models'

export interface OpenDoc {
  path: string
  content: string
  encoding: string
  fileName: string
  fileSize: number
  modTime: string
}

export interface FileApi {
  doc: OpenDoc | null
  loading: boolean
  /** 普通提示（如：文件已被删除/移动） */
  notice: string | null
  /** 错误提示（danger 色） */
  danger: string | null
  open: () => Promise<void>
  /** 打开指定路径（拖拽/测试用） */
  openPath: (path: string) => Promise<void>
  reload: () => Promise<void>
  clearNotice: () => void
  clearDanger: () => void
}

/** 提取文件名（兼容 / 与 \）。 */
function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/**
 * 文件生命周期：打开（对话框/拖拽）→ 读取 → 元信息 → 监视。
 * 订阅后端 "file:changed" 事件（后端已 300ms 节流）实现自动刷新；
 * remove/rename 转为状态栏提示。
 */
export function useFile(): FileApi {
  const [doc, setDoc] = useState<OpenDoc | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [danger, setDanger] = useState<string | null>(null)

  const docRef = useRef<OpenDoc | null>(null)
  docRef.current = doc

  const load = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const res = await ReadFile(path)
      let meta: main.FileInfo | null = null
      try {
        meta = await GetFileInfo(path)
      } catch {
        /* 元信息缺失不致命，状态栏降级显示 */
      }
      const next: OpenDoc = {
        path,
        content: res.Content,
        encoding: res.Encoding,
        fileName: meta?.Name ?? baseName(path),
        fileSize: meta?.Size ?? 0,
        modTime: meta?.ModTime ?? '',
      }
      setDoc(next)
      setNotice(null)
      setDanger(null)
      // 监视当前文件所在目录；切换文件时后端自动停掉旧 watcher
      try {
        await WatchFile(path)
      } catch {
        /* 监视失败不阻塞打开 */
      }
    } catch (err) {
      setDanger(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const open = useCallback(async () => {
    try {
      const path = await OpenFileDialog()
      if (!path) return // 用户取消
      await load(path)
    } catch (err) {
      setDanger(String(err))
    }
  }, [load])

  const openPath = useCallback(
    async (path: string) => {
      try {
        await load(path)
      } catch (err) {
        setDanger(String(err))
      }
    },
    [load],
  )

  const reload = useCallback(async () => {
    const cur = docRef.current
    if (cur) await load(cur.path)
  }, [load])

  // 订阅文件变更事件（后端节流 300ms 后发出）
  useEffect(() => {
    const off = EventsOn('file:changed', (data: unknown) => {
      const ev = data as { path?: string; op?: string }
      const cur = docRef.current
      if (!cur || !ev.path) return
      if (ev.path.toLowerCase() !== cur.path.toLowerCase()) return
      if (ev.op === 'write') {
        void load(cur.path)
      } else if (ev.op === 'remove' || ev.op === 'rename') {
        setNotice(ev.op === 'remove' ? '文件已被删除' : '文件已被移动或重命名')
      }
    })
    return off
  }, [load])

  return {
    doc,
    loading,
    notice,
    danger,
    open,
    openPath,
    reload,
    clearNotice: () => setNotice(null),
    clearDanger: () => setDanger(null),
  }
}
