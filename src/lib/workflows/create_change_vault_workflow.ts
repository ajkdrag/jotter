import { change_vault } from '$lib/operations/change_vault'
import { open_last_vault } from '$lib/operations/open_last_vault'
import type { VaultId } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Ports } from '$lib/adapters/create_prod_ports'

type AppState = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
}

export type VaultChangeResult = {
  vault: Vault
  notes: NoteMeta[]
}

export function create_change_vault_workflow(args: {
  ports: Ports
  state: AppState
}) {
  const { ports, state } = args

  async function refresh_recent() {
    state.recent_vaults = await ports.vault.list_vaults()
  }

  return {
    async choose_and_change(): Promise<VaultChangeResult | null> {
      const vault_path = await ports.vault.choose_vault()
      if (!vault_path) return null
      const result = await change_vault(ports, { vault_path })
      state.vault = result.vault
      state.notes = result.notes
      state.open_note = null
      void ports.index.build_index(result.vault.id)
      await refresh_recent()
      return result
    },
    async open_last_vault(): Promise<VaultChangeResult | null> {
      const result = await open_last_vault(ports)
      if (!result) return null
      state.vault = result.vault
      state.notes = result.notes
      state.open_note = null
      void ports.index.build_index(result.vault.id)
      await refresh_recent()
      return result
    },
    async open_recent(vault_id: VaultId): Promise<VaultChangeResult> {
      const vault = await ports.vault.open_vault_by_id(vault_id)
      const notes = await ports.notes.list_notes(vault.id)
      state.vault = vault
      state.notes = notes
      state.open_note = null
      await ports.vault.remember_last_vault(vault.id)
      void ports.index.build_index(vault.id)
      await refresh_recent()
      return { vault, notes }
    },
    async load_recent() {
      await refresh_recent()
    }
  }
}
