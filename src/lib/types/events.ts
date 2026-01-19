import type { NotePath, VaultId } from '$lib/types/ids'

export type VaultFsEvent =
  | { type: 'note_changed_externally'; vault_id: VaultId; note_path: NotePath }
  | { type: 'note_added'; vault_id: VaultId; note_path: NotePath }
  | { type: 'note_removed'; vault_id: VaultId; note_path: NotePath }
  | { type: 'asset_changed'; vault_id: VaultId; asset_path: string }

