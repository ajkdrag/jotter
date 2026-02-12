import type { Vault } from "$lib/types/vault";

export function search_vaults(vaults: Vault[], query: string): Vault[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return vaults;
  }
  return vaults.filter((vault) => {
    const name_match = vault.name.toLowerCase().includes(normalized);
    if (name_match) {
      return true;
    }
    return vault.path.toLowerCase().includes(normalized);
  });
}
