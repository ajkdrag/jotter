import type { StoreHandle } from './store_handle'
import type { Vault } from '$lib/types/vault'
import { create_store } from './create_store.svelte'

export type VaultState = {
  vault: Vault | null
  recent_vaults: Vault[]
}

export type VaultActions = {
  set_vault: (vault: Vault) => void
  clear_vault: () => void
  set_recent_vaults: (vaults: Vault[]) => void
}

export type VaultStore = StoreHandle<VaultState, VaultActions>

export function create_vault_store(): VaultStore {
  return create_store<VaultState, VaultActions>(
    {
      vault: null,
      recent_vaults: []
    },
    (get, set) => ({
      set_vault: (vault) => {
        set({ ...get(), vault })
      },
      clear_vault: () => {
        set({ ...get(), vault: null })
      },
      set_recent_vaults: (recent_vaults) => {
        set({ ...get(), recent_vaults })
      }
    })
  )
}
