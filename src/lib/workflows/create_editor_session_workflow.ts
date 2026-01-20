import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

export type EditorSessionState = {
  vault: Vault | null
  notes: NoteMeta[]
  open_note: OpenNoteState | null
}

export function create_editor_session_workflow(args: {
  state: EditorSessionState
  now?: () => number
}) {
  const now = args.now ?? (() => Date.now())

  function next_untitled_name(notes: NoteMeta[]): string {
    let max = 0

    for (const note of notes) {
      const match = String(note.path).match(/^Untitled-(\d+)$/)
      if (!match) continue
      const value = Number(match[1])
      if (!Number.isFinite(value)) continue
      if (value > max) max = value
    }

    return `Untitled-${max + 1}`
  }

  function create_untitled_note(notes: NoteMeta[]): OpenNoteState {
    const name = next_untitled_name(notes)
    const timestamp_ms = now()

    return {
      meta: {
        id: as_note_path(name),
        path: as_note_path(name),
        title: name,
        mtime_ms: timestamp_ms,
        size_bytes: 0
      },
      markdown: as_markdown_text(''),
      dirty: false,
      last_saved_at_ms: timestamp_ms
    }
  }

  return {
    ensure_open_note() {
      const { state } = args
      if (!state.vault) return
      if (state.open_note) return
      state.open_note = create_untitled_note(state.notes)
    }
  }
}
