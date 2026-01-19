import type { VaultPort } from '$lib/ports/vault_port'
import { choose_vault_directory } from '$lib/adapters/tauri/dialog_adapter'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

export function create_vault_tauri_adapter(): VaultPort {
  return {
    choose_vault: choose_vault_directory,
    async open_vault(vault_path: VaultPath) {
      return await tauri_invoke<Vault>('open_vault', { args: { vault_path } })
    },
    async open_vault_by_id(vault_id: VaultId) {
      return await tauri_invoke<Vault>('open_vault_by_id', { vault_id })
    },
    async list_vaults() {
      return await tauri_invoke<Vault[]>('list_vaults')
    },
    async remember_last_vault(vault_id: VaultId) {
      await tauri_invoke<void>('remember_last_vault', { args: { vault_id } })
    },
    async get_last_vault_id() {
      return await tauri_invoke<VaultId | null>('get_last_vault_id')
    }
  }
}

