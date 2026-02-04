import type { StoreHandle } from './store_handle'
import type { MarkdownText, NoteId, NotePath } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'
import type { NoteMeta } from '$lib/types/note'
import { create_store } from './create_store.svelte'
import { ensure_open_note, create_untitled_open_note_in_folder } from '$lib/operations/ensure_open_note'
import type { Vault } from '$lib/types/vault'

export type EditorState = {
  open_note: OpenNoteState | null
}

export type EditorActions = {
  set_open_note: (note: OpenNoteState) => void
  clear_open_note: () => void
  update_markdown: (markdown: MarkdownText) => void
  update_dirty_state: (is_dirty: boolean) => void
  update_path: (path: NotePath) => void
  update_path_prefix: (old_prefix: string, new_prefix: string) => void
  ensure_open_note: (vault: Vault | null, notes: NoteMeta[], now_ms: number) => void
  create_new_note_in_folder: (notes: NoteMeta[], folder_prefix: string, now_ms: number) => void
}

export type EditorStore = StoreHandle<EditorState, EditorActions>

export function create_editor_store(): EditorStore {
  return create_store<EditorState, EditorActions>(
    {
      open_note: null
    },
    (get, set) => ({
      set_open_note: (open_note) => {
        set({ open_note })
      },

      clear_open_note: () => {
        set({ open_note: null })
      },

      update_markdown: (markdown) => {
        const state = get()
        if (!state.open_note) return
        set({ open_note: { ...state.open_note, markdown } })
      },

      update_dirty_state: (is_dirty) => {
        const state = get()
        if (!state.open_note) return
        set({ open_note: { ...state.open_note, is_dirty } })
      },

      update_path: (new_path) => {
        const state = get()
        if (!state.open_note) return

        const parts = new_path.split('/')
        const leaf = parts[parts.length - 1] ?? ''
        const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

        set({
          open_note: {
            ...state.open_note,
            meta: { ...state.open_note.meta, id: new_path, path: new_path, title }
          }
        })
      },

      update_path_prefix: (old_prefix, new_prefix) => {
        const state = get()
        if (!state.open_note) return

        const current_path = state.open_note.meta.path
        if (!current_path.startsWith(old_prefix)) return

        const new_path = new_prefix + current_path.slice(old_prefix.length)
        const parts = new_path.split('/')
        const leaf = parts[parts.length - 1] ?? ''
        const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

        set({
          open_note: {
            ...state.open_note,
            meta: { ...state.open_note.meta, id: new_path as NoteId, path: new_path as NotePath, title }
          }
        })
      },

      ensure_open_note: (vault, notes, now_ms) => {
        const state = get()
        const result = ensure_open_note({
          vault,
          notes,
          open_note: state.open_note,
          now_ms
        })
        set({ open_note: result })
      },

      create_new_note_in_folder: (notes, folder_prefix, now_ms) => {
        const new_note = create_untitled_open_note_in_folder({
          notes,
          folder_prefix,
          now_ms
        })
        set({ open_note: new_note })
      }
    })
  )
}
