import type { EditorSettings } from '$lib/types/editor_settings'

export type CursorInfo = {
  line: number
  column: number
  total_lines: number
}

export type EditorHandle = {
  destroy: () => void
  set_markdown: (markdown: string) => void
  get_markdown: () => string
  mark_clean: () => void
  is_dirty: () => boolean
  focus: () => void
}

export type EditorPort = {
  create_editor: (
    root: HTMLElement,
    config: {
      initial_markdown: string
      note_path: string
      link_syntax: EditorSettings['link_syntax']
      on_markdown_change: (markdown: string) => void
      on_dirty_state_change: (is_dirty: boolean) => void
      on_cursor_change?: (info: CursorInfo) => void
      on_wiki_link_click?: (note_path: string) => void
    }
  ) => Promise<EditorHandle>
}
