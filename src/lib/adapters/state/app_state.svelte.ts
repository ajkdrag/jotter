import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'

export type AppState = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
  is_change_vault_dialog_open: boolean
}

export const app_state = $state<AppState>({
  vault: null,
  recent_vaults: [],
  notes: [],
  open_note: null,
  is_change_vault_dialog_open: false
})
