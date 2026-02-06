import type { StoreHandle } from './store_handle'
import type { Vault } from '$lib/types/vault'
import { create_store } from './create_store.svelte'
import type { AppEvent } from '$lib/events/app_event'

export type VaultState = {
  vault: Vault | null
  recent_vaults: Vault[]
  generation: number
}

export type VaultStore = StoreHandle<VaultState, AppEvent>

export function create_vault_store(): VaultStore {
  return create_store<VaultState, AppEvent>(
    {
      vault: null,
      recent_vaults: [],
      generation: 0
    },
    (state, event) => {
      switch (event.type) {
        case 'vault_set':
          return { ...state, vault: event.vault, generation: state.generation + 1 }
        case 'vault_cleared':
          return { ...state, vault: null, generation: state.generation + 1 }
        case 'recent_vaults_set':
          return { ...state, recent_vaults: event.vaults }
        default:
          return state
      }
    }
  )
}
