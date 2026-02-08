import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

function next_untitled_name_in_folder(notes: NoteMeta[], folder_prefix: string): string {
  let max = 0
  const folder_path = folder_prefix ? `${folder_prefix}/` : ''
  const pattern = new RegExp(`^${folder_path.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}Untitled-(\\d+)\\.md$`)

  for (const note of notes) {
    const match = String(note.path).match(pattern)
    if (!match) continue
    const value = Number(match[1])
    if (!Number.isFinite(value)) continue
    if (value > max) max = value
  }
  return `Untitled-${String(max + 1)}`
}

function create_untitled_open_note(args: { notes: NoteMeta[]; now_ms: number }): OpenNoteState {
  return create_untitled_open_note_in_folder({ ...args, folder_prefix: '' })
}

export function create_untitled_open_note_in_folder(args: {
  notes: NoteMeta[]
  folder_prefix: string
  now_ms: number
}): OpenNoteState {
  const name = next_untitled_name_in_folder(args.notes, args.folder_prefix)
  const path_with_folder = args.folder_prefix ? `${args.folder_prefix}/${name}` : name

  return {
    meta: {
      id: as_note_path(path_with_folder),
      path: as_note_path(path_with_folder),
      title: name,
      mtime_ms: args.now_ms,
      size_bytes: 0
    },
    markdown: as_markdown_text(''),
    buffer_id: `untitled:${String(args.now_ms)}:${path_with_folder}`,
    is_dirty: false
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

