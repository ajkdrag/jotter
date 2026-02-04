import type { EditorSettings } from '$lib/types/editor_settings'
import type { ImagePasteData } from '$lib/types/image_paste'
import type { AssetPath } from '$lib/types/ids'

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
  insert_text_at_cursor: (text: string) => void
  create_editor: (
    root: HTMLElement,
    config: {
      initial_markdown: string
      note_path: string
      link_syntax: EditorSettings['link_syntax']
      resolve_asset_url?: (asset_path: AssetPath) => Promise<string>
      on_markdown_change: (markdown: string) => void
      on_dirty_state_change: (is_dirty: boolean) => void
      on_cursor_change?: (info: CursorInfo) => void
      on_wiki_link_click?: (note_path: string) => void
      on_image_paste?: (data: ImagePasteData) => void
    }
  ) => Promise<EditorHandle>
}
