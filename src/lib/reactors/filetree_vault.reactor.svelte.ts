import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { FolderService } from '$lib/services/folder_service'

export function create_filetree_vault_reactor(
  vault_store: VaultStore,
  folder_service: FolderService
): () => void {
  let previous_generation = vault_store.generation

  return $effect.root(() => {
    $effect(() => {
      const generation = vault_store.generation
      if (generation === previous_generation) return
      previous_generation = generation
      void folder_service.on_vault_changed()
    })
  })
}
