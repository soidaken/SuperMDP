/** 文件大小人类可读格式化。 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 字数格式化：<10000 显示原值，否则 1.2 万。 */
export function formatWordCount(count: number): string {
  if (count < 10000) return `${count} 字`
  return `${(count / 10000).toFixed(1)} 万字`
}

/** Markdown 扩展名判断（.md / .markdown / .mdown）。 */
export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase()
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.mdown')
  )
}
