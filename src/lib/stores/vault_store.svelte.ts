import type { Vault } from '$lib/types/vault'

export class VaultStore {
  vault = $state<Vault | null>(null)
  recent_vaults = $state<Vault[]>([])
  generation = $state(0)

  clear() {
    this.vault = null
    this.generation += 1
  }

  set_vault(vault: Vault) {
    this.vault = vault
    this.generation += 1
  }

  set_recent_vaults(vaults: Vault[]) {
    this.recent_vaults = vaults
  }

  bump_generation() {
    this.generation += 1
  }

  reset() {
    this.vault = null
    this.recent_vaults = []
    this.generation += 1
  }
}
