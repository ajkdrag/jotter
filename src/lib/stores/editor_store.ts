import type { StoreHandle } from './store_handle'
import type { NoteId, NotePath } from '$lib/types/ids'
import type { OpenNoteState, CursorInfo } from '$lib/types/editor'
import { create_store } from './create_store.svelte'
import type { AppEvent } from '$lib/events/app_event'

export type EditorState = {
  open_note: OpenNoteState | null
  cursor: CursorInfo | null
}

export type EditorStore = StoreHandle<EditorState, AppEvent>

function update_path(open_note: OpenNoteState, new_path: NotePath): OpenNoteState {
  const parts = new_path.split('/')
  const leaf = parts[parts.length - 1] ?? ''
  const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

  return {
    ...open_note,
    meta: { ...open_note.meta, id: new_path, path: new_path, title }
  }
}

function update_path_prefix(open_note: OpenNoteState, old_prefix: string, new_prefix: string): OpenNoteState {
  const current_path = open_note.meta.path
  if (!current_path.startsWith(old_prefix)) return open_note

  const new_path = new_prefix + current_path.slice(old_prefix.length)
  const parts = new_path.split('/')
  const leaf = parts[parts.length - 1] ?? ''
  const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

  return {
    ...open_note,
    meta: { ...open_note.meta, id: new_path as NoteId, path: new_path as NotePath, title }
  }
}

export function create_editor_store(): EditorStore {
  return create_store<EditorState, AppEvent>(
    {
      open_note: null,
      cursor: null
    },
    (state, event) => {
      switch (event.type) {
        case 'open_note_set':
          return { ...state, open_note: event.open_note, cursor: null }
        case 'open_note_cleared':
          return { ...state, open_note: null, cursor: null }
        case 'open_note_markdown_updated': {
          if (!state.open_note) return state
          return { ...state, open_note: { ...state.open_note, markdown: event.markdown } }
        }
        case 'open_note_dirty_updated': {
          if (!state.open_note) return state
          return { ...state, open_note: { ...state.open_note, is_dirty: event.is_dirty } }
        }
        case 'open_note_path_updated': {
          if (!state.open_note) return state
          return { ...state, open_note: update_path(state.open_note, event.new_path) }
        }
        case 'open_note_path_prefix_updated': {
          if (!state.open_note) return state
          return { ...state, open_note: update_path_prefix(state.open_note, event.old_prefix, event.new_prefix) }
        }
        case 'editor_markdown_changed': {
          if (!state.open_note) return state
          if (state.open_note.meta.id !== event.note_id) return state
          return { ...state, open_note: { ...state.open_note, markdown: event.markdown } }
        }
        case 'editor_dirty_changed': {
          if (!state.open_note) return state
          if (state.open_note.meta.id !== event.note_id) return state
          return { ...state, open_note: { ...state.open_note, is_dirty: event.is_dirty } }
        }
        case 'note_saved': {
          if (!state.open_note) return state
          if (state.open_note.meta.id !== event.note_id) return state
          return { ...state, open_note: { ...state.open_note, is_dirty: false } }
        }
        case 'editor_cursor_changed': {
          if (!state.open_note) return state
          if (state.open_note.meta.id !== event.note_id) return state
          return { ...state, cursor: event.cursor }
        }
        default:
          return state
      }
    }
  )
}
