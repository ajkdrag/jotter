export type EditorHandle = {
  destroy: () => void
  set_markdown: (markdown: string) => void
  get_markdown: () => string
}

export type EditorPort = {
  create_editor: (
    root: HTMLElement,
    config: {
      initial_markdown: string
      on_markdown_change: (markdown: string) => void
    }
  ) => Promise<EditorHandle>
}
