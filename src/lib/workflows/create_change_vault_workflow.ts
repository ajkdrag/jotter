import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import { change_vault } from '$lib/operations/change_vault'
import { open_last_vault } from '$lib/operations/open_last_vault'
import type { VaultId } from '$lib/types/ids'
import { ensure_watching } from '$lib/workflows/watcher_session'

export function create_change_vault_workflow() {
  async function refresh_recent() {
    app_state.recent_vaults = await ports.vault.list_vaults()
  }

  return {
    async choose_and_change() {
      const vault_path = await ports.vault.choose_vault()
      if (!vault_path) return
      const result = await change_vault(ports, { vault_path })
      app_state.vault = result.vault
      app_state.notes = result.notes
      app_state.open_note = null
      app_state.search_results = []
      app_state.conflict = null
      await ensure_watching(result.vault.id)
      void ports.index.build_index(result.vault.id)
      await refresh_recent()
    },
    async open_last_vault() {
      const result = await open_last_vault(ports)
      if (!result) return
      app_state.vault = result.vault
      app_state.notes = result.notes
      app_state.open_note = null
      app_state.conflict = null
      await ensure_watching(result.vault.id)
      void ports.index.build_index(result.vault.id)
      await refresh_recent()
    },
    async open_recent(vault_id: VaultId) {
      const vault = await ports.vault.open_vault_by_id(vault_id)
      const notes = await ports.notes.list_notes(vault.id)
      app_state.vault = vault
      app_state.notes = notes
      app_state.open_note = null
      app_state.conflict = null
      await ports.vault.remember_last_vault(vault.id)
      await ensure_watching(vault.id)
      void ports.index.build_index(vault.id)
      await refresh_recent()
    },
    async load_recent() {
      await refresh_recent()
    }
  }
}
