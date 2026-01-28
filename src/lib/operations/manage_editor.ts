import type { EditorHandle, EditorPort } from '$lib/ports/editor_port'
import type { OpenNoteState } from '$lib/types/editor'

export type EditorManager = {
  mount: (root: HTMLElement, note: OpenNoteState, on_change: (md: string) => void) => Promise<void>
  update: (note: OpenNoteState) => void
  destroy: () => void
}

export function create_editor_manager(editor_port: EditorPort): EditorManager {
  let editor_handle: EditorHandle | null = null
  let current_buffer_id: string | null = null

  return {
    async mount(root: HTMLElement, note: OpenNoteState, on_change: (md: string) => void) {
      if (editor_handle) {
        editor_handle.destroy()
        editor_handle = null
      }

      current_buffer_id = note.buffer_id
      editor_handle = await editor_port.create_editor(root, {
        initial_markdown: note.markdown,
        on_markdown_change: on_change,
      })
    },

    update(note: OpenNoteState) {
      if (!editor_handle) return
      if (current_buffer_id === note.buffer_id) return

      current_buffer_id = note.buffer_id
      editor_handle.set_markdown(note.markdown)
    },

    destroy() {
      if (editor_handle) {
        editor_handle.destroy()
        editor_handle = null
      }
      current_buffer_id = null
    },
  }
}
