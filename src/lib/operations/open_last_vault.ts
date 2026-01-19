import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { NoteMeta } from '$lib/types/note'
import type { Vault } from '$lib/types/vault'

export async function open_last_vault(ports: {
  vault: VaultPort
  notes: NotesPort
}): Promise<{ vault: Vault; notes: NoteMeta[] } | null> {
  const last_id = await ports.vault.get_last_vault_id()
  if (!last_id) return null
  const vault = await ports.vault.open_vault_by_id(last_id)
  const notes = await ports.notes.list_notes(vault.id)
  return { vault, notes }
}

