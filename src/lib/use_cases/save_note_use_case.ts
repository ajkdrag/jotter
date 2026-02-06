import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { OpenNoteState } from '$lib/types/editor'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'

export async function save_note_use_case(
  ports: { notes: NotesPort; index: WorkspaceIndexPort },
  args: { vault_id: VaultId; open_note: OpenNoteState; new_path: NotePath | null }
): Promise<AppEvent[]> {
  const is_untitled = !args.open_note.meta.path.endsWith('.md')

  if (is_untitled && args.new_path) {
    const new_note_meta = await ports.notes.create_note(
      args.vault_id,
      args.new_path,
      args.open_note.markdown
    )
    await ports.index.upsert_note(args.vault_id, new_note_meta.id)

    return [
      { type: 'note_added', note: new_note_meta },
      { type: 'open_note_path_updated', new_path: args.new_path },
      { type: 'note_saved', note_id: new_note_meta.id }
    ]
  }

  await ports.notes.write_note(args.vault_id, args.open_note.meta.id, args.open_note.markdown)
  await ports.index.upsert_note(args.vault_id, args.open_note.meta.id)

  return [{ type: 'note_saved', note_id: args.open_note.meta.id }]
}
