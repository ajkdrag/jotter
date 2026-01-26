import type { NoteDoc } from '$lib/types/note'

export type EditorSelection = {
  anchor: number
  head: number
}

export type OpenNoteState = NoteDoc & {
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
    dirty: false,
    revision_id: 0,
    saved_revision_id: 0,
    sticky_dirty: false,
    last_saved_at_ms: Date.now()
  }
}
