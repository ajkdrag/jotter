import type { VaultId, VaultPath } from "$lib/types/ids";
import type { Vault } from "$lib/types/vault";

export interface VaultPort {
  choose_vault(): Promise<VaultPath | null>;
  open_vault(vault_path: VaultPath): Promise<Vault>;
  open_vault_by_id(vault_id: VaultId): Promise<Vault>;
  list_vaults(): Promise<Vault[]>;
  remember_last_vault(vault_id: VaultId): Promise<void>;
  get_last_vault_id(): Promise<VaultId | null>;
}
