export type EditorHandle = {
  destroy: () => void
  set_markdown: (markdown: string) => void
  get_markdown: () => string
  mark_clean: () => void
  is_dirty: () => boolean
}

export type EditorPort = {
  create_editor: (
    root: HTMLElement,
    config: {
      initial_markdown: string
      on_markdown_change: (markdown: string) => void
      on_dirty_state_change: (is_dirty: boolean) => void
    }
  ) => Promise<EditorHandle>
}
