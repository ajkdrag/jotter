import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

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

export function create_untitled_open_note(args: { notes: NoteMeta[]; now_ms: number }): OpenNoteState {
  const name = next_untitled_name(args.notes)
  return {
    meta: {
      id: as_note_path(name),
      path: as_note_path(name),
      title: name,
      mtime_ms: args.now_ms,
      size_bytes: 0
    },
    markdown: as_markdown_text(''),
    dirty: false,
    last_saved_at_ms: args.now_ms
  }
}

export function ensure_open_note(args: {
  vault: Vault | null
  notes: NoteMeta[]
  open_note: OpenNoteState | null
  now_ms: number
}): OpenNoteState | null {
  if (!args.vault) return args.open_note
  if (args.open_note) return args.open_note
  return create_untitled_open_note({ notes: args.notes, now_ms: args.now_ms })
}

