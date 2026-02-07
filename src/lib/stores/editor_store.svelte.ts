import type { OpenNoteState, CursorInfo } from '$lib/types/editor'
import type { NoteId, NotePath } from '$lib/types/ids'

function path_title(path: string): string {
  const parts = path.split('/')
  const leaf = parts[parts.length - 1] ?? ''
  return leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf
}

export class EditorStore {
  open_note = $state<OpenNoteState | null>(null)
  cursor = $state<CursorInfo | null>(null)

  set_open_note(open_note: OpenNoteState) {
    this.open_note = open_note
    this.cursor = null
  }

  clear_open_note() {
    this.open_note = null
    this.cursor = null
  }

  set_markdown(note_id: NoteId, markdown: OpenNoteState['markdown']) {
    if (!this.open_note) return
    if (this.open_note.meta.id !== note_id) return
    this.open_note = {
      ...this.open_note,
      markdown
    }
  }

  set_dirty(note_id: NoteId, is_dirty: boolean) {
    if (!this.open_note) return
    if (this.open_note.meta.id !== note_id) return
    this.open_note = {
      ...this.open_note,
      is_dirty
    }
  }

  mark_clean(note_id: NoteId) {
    this.set_dirty(note_id, false)
  }

  update_open_note_path(new_path: NotePath) {
    if (!this.open_note) return
    this.open_note = {
      ...this.open_note,
      meta: {
        ...this.open_note.meta,
        id: new_path,
        path: new_path,
        title: path_title(new_path)
      }
    }
  }

  update_open_note_path_prefix(old_prefix: string, new_prefix: string) {
    if (!this.open_note) return
    const current_path = this.open_note.meta.path
    if (!current_path.startsWith(old_prefix)) return

    const new_path = `${new_prefix}${current_path.slice(old_prefix.length)}` as NotePath
    this.open_note = {
      ...this.open_note,
      meta: {
        ...this.open_note.meta,
        id: new_path,
        path: new_path,
        title: path_title(new_path)
      }
    }
  }

  set_cursor(note_id: NoteId, cursor: CursorInfo | null) {
    if (!this.open_note) return
    if (this.open_note.meta.id !== note_id) return
    this.cursor = cursor
  }

  reset() {
    this.open_note = null
    this.cursor = null
  }
}
