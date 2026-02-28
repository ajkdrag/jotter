import type { Vault } from "$lib/shared/types/vault";
import type { VaultId } from "$lib/shared/types/ids";

function normalize_pinned_vault_ids(vault_ids: VaultId[]): VaultId[] {
  const seen = new Set<VaultId>();
  const normalized: VaultId[] = [];
  for (const vault_id of vault_ids) {
    if (seen.has(vault_id)) continue;
    seen.add(vault_id);
    normalized.push(vault_id);
  }
  return normalized;
}

export class VaultStore {
  vault = $state<Vault | null>(null);
  recent_vaults = $state<Vault[]>([]);
  pinned_vault_ids = $state<VaultId[]>([]);
  generation = $state(0);

  clear() {
    this.vault = null;
    this.generation += 1;
  }

  set_vault(vault: Vault) {
    this.vault = vault;
    this.generation += 1;
  }

  set_recent_vaults(vaults: Vault[]) {
    const known_ids = new Set(vaults.map((vault) => vault.id));
    this.pinned_vault_ids = this.pinned_vault_ids.filter((vault_id) =>
      known_ids.has(vault_id),
    );
    this.recent_vaults = this.sort_recent_vaults(vaults, this.pinned_vault_ids);
  }

  set_pinned_vault_ids(vault_ids: VaultId[]) {
    const normalized = normalize_pinned_vault_ids(vault_ids);
    const known_ids = new Set(this.recent_vaults.map((vault) => vault.id));
    this.pinned_vault_ids = normalized.filter((vault_id) =>
      known_ids.has(vault_id),
    );
    this.recent_vaults = this.sort_recent_vaults(
      this.recent_vaults,
      this.pinned_vault_ids,
    );
  }

  toggle_pinned_vault(vault_id: VaultId) {
    if (this.pinned_vault_ids.includes(vault_id)) {
      this.pinned_vault_ids = this.pinned_vault_ids.filter(
        (id) => id !== vault_id,
      );
    } else {
      this.pinned_vault_ids = [...this.pinned_vault_ids, vault_id];
    }
    this.recent_vaults = this.sort_recent_vaults(
      this.recent_vaults,
      this.pinned_vault_ids,
    );
  }

  set_vault_availability(vault_id: VaultId, is_available: boolean) {
    this.recent_vaults = this.recent_vaults.map((vault) =>
      vault.id === vault_id ? { ...vault, is_available } : vault,
    );

    if (this.vault?.id === vault_id) {
      this.vault = { ...this.vault, is_available };
      this.generation += 1;
    }
  }

  get_pinned_vault_id_by_slot(slot: number): VaultId | null {
    if (slot < 0) return null;
    return this.pinned_vault_ids[slot] ?? null;
  }

  bump_generation() {
    this.generation += 1;
  }

  reset() {
    this.vault = null;
    this.recent_vaults = [];
    this.pinned_vault_ids = [];
    this.generation += 1;
  }

  private sort_recent_vaults(vaults: Vault[], pinned_ids: VaultId[]): Vault[] {
    const pin_priority = new Map<VaultId, number>();
    pinned_ids.forEach((vault_id, index) => {
      pin_priority.set(vault_id, index);
    });

    return [...vaults].sort((left, right) => {
      const left_pin = pin_priority.get(left.id);
      const right_pin = pin_priority.get(right.id);
      const left_pinned = left_pin !== undefined;
      const right_pinned = right_pin !== undefined;

      if (left_pinned && right_pinned) {
        return left_pin - right_pin;
      }
      if (left_pinned) return -1;
      if (right_pinned) return 1;

      return (right.last_opened_at ?? 0) - (left.last_opened_at ?? 0);
    });
  }
}
