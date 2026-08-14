declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'

  interface TexmathOptions {
    engine: unknown
    delimiters?: string | string[]
    katexOptions?: Record<string, unknown>
  }

  const texmath: {
    (md: MarkdownIt, options?: TexmathOptions): void
    use: unknown
    inline: unknown
    block: unknown
    render: unknown
    rules: unknown
  }

  export default texmath
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const taskLists: (md: MarkdownIt, options?: TaskListOptions) => void
  export default taskLists
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'

  const footnote: (md: MarkdownIt, options?: Record<string, unknown>) => void
  export default footnote
}
