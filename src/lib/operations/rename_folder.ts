import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'

export async function rename_folder(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; from_path: string; to_path: string }
): Promise<void> {
  await ports.notes.rename_folder(args.vault_id, args.from_path, args.to_path)
}
