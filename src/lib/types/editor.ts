import type { NoteDoc } from '$lib/types/note'

export type OpenNoteState = NoteDoc & {
  buffer_id: string
  is_dirty: boolean
}

export type CursorInfo = {
  line: number
  column: number
  total_lines: number
}

export function to_open_note_state(doc: NoteDoc): OpenNoteState {
  return {
    ...doc,
    buffer_id: doc.meta.id,
    is_dirty: false
  }
}
