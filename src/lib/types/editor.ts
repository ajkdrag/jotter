import type { NoteDoc, NoteMeta } from '$lib/types/note'

export type EditorSelection = {
  anchor: number
  head: number
}

export type OpenNoteState = NoteDoc & {
  dirty: boolean
  last_saved_at_ms?: number
  selection?: EditorSelection
}

export function to_open_note_state(doc: NoteDoc): OpenNoteState {
  return {
    ...doc,
    dirty: false,
    last_saved_at_ms: Date.now()
  }
}
