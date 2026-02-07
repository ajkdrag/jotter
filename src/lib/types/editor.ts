import type { NoteDoc } from '$lib/types/note'
import type { NoteId, NotePath } from '$lib/types/ids'

export type OpenNoteState = NoteDoc & {
  buffer_id: string
  is_dirty: boolean
}

export type CursorInfo = {
  line: number
  column: number
  total_lines: number
}

export type PastedImagePayload = {
  bytes: Uint8Array
  mime_type: string
  file_name: string | null
}

export type ImagePasteRequest = {
  note_id: NoteId
  note_path: NotePath
  image: PastedImagePayload
  event_id: number
}

export function to_open_note_state(doc: NoteDoc): OpenNoteState {
  return {
    ...doc,
    buffer_id: doc.meta.id,
    is_dirty: false
  }
}
