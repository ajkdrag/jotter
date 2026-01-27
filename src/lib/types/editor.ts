import type { NoteDoc } from '$lib/types/note'

export type EditorSelection = {
  anchor: number
  head: number
}

export type OpenNoteState = NoteDoc & {
  // Stable identity for the in-memory editor buffer.
  // This must remain unchanged across renames so undo history and dirty tracking survive.
  buffer_id: string
  dirty: boolean
  revision_id: number
  saved_revision_id: number
  sticky_dirty: boolean
  last_saved_at_ms?: number
  selection?: EditorSelection
}

export function to_open_note_state(doc: NoteDoc): OpenNoteState {
  return {
    ...doc,
    buffer_id: doc.meta.id,
    dirty: false,
    revision_id: 0,
    saved_revision_id: 0,
    sticky_dirty: false,
    last_saved_at_ms: Date.now()
  }
}
