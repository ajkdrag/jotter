import type { NotesPort } from '$lib/ports/notes_port'
import type { NotePath, VaultId } from '$lib/types/ids'

export async function rename_note(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; from: NotePath; to: NotePath }
): Promise<void> {
  await ports.notes.rename_note(args.vault_id, args.from, args.to)
}
