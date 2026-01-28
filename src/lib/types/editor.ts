import type { NoteDoc } from '$lib/types/note'

export type OpenNoteState = NoteDoc & {
  buffer_id: string
}

export function to_open_note_state(doc: NoteDoc): OpenNoteState {
  return {
    ...doc,
    buffer_id: doc.meta.id
  }
}
