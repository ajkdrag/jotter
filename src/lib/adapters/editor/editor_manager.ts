import type { EditorHandle, EditorPort, CursorInfo } from '$lib/ports/editor_port'
import type { OpenNoteState } from '$lib/types/editor'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { ImagePasteData } from '$lib/types/image_paste'

export type EditorManager = {
  mount: (
    root: HTMLElement,
    note: OpenNoteState,
    on_change: (md: string) => void,
    on_dirty_change: (is_dirty: boolean) => void,
    link_syntax: EditorSettings['link_syntax'],
    on_cursor_change?: (info: CursorInfo) => void,
    on_wiki_link_click?: (note_path: string) => void,
    on_image_paste?: (data: ImagePasteData) => void
  ) => Promise<void>
  update: (note: OpenNoteState) => void
  destroy: () => void
  mark_clean: () => void
  focus: () => void
}

export function create_editor_manager(editor_port: EditorPort): EditorManager {
  let editor_handle: EditorHandle | null = null
  let current_buffer_id: string | null = null

  return {
    async mount(
      root: HTMLElement,
      note: OpenNoteState,
      on_change: (md: string) => void,
      on_dirty_change: (is_dirty: boolean) => void,
      link_syntax: EditorSettings['link_syntax'],
      on_cursor_change?: (info: CursorInfo) => void,
      on_wiki_link_click?: (note_path: string) => void,
      on_image_paste?: (data: ImagePasteData) => void
    ) {
      if (editor_handle) {
        editor_handle.destroy()
        editor_handle = null
      }

      current_buffer_id = note.buffer_id
      editor_handle = await editor_port.create_editor(root, {
        initial_markdown: note.markdown,
        note_path: note.meta.path,
        link_syntax,
        on_markdown_change: on_change,
        on_dirty_state_change: on_dirty_change,
        ...(on_cursor_change && { on_cursor_change }),
        ...(on_wiki_link_click && { on_wiki_link_click }),
        ...(on_image_paste && { on_image_paste })
      })
    },

    update(note: OpenNoteState) {
      if (!editor_handle) return
      if (current_buffer_id === note.buffer_id) return

      current_buffer_id = note.buffer_id
      editor_handle.set_markdown(note.markdown)
      editor_handle.mark_clean()
    },

    destroy() {
      if (editor_handle) {
        editor_handle.destroy()
        editor_handle = null
      }
      current_buffer_id = null
    },

    mark_clean() {
      if (editor_handle) {
        editor_handle.mark_clean()
      }
    },

    focus() {
      if (editor_handle) {
        editor_handle.focus()
      }
    }
  }
}
