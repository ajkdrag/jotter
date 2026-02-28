import type { VaultId, VaultPath } from "$lib/shared/types/ids";
import type { Vault } from "$lib/shared/types/vault";

export interface VaultPort {
  choose_vault(): Promise<VaultPath | null>;
  open_vault(vault_path: VaultPath): Promise<Vault>;
  open_vault_by_id(vault_id: VaultId): Promise<Vault>;
  list_vaults(): Promise<Vault[]>;
  remove_vault(vault_id: VaultId): Promise<void>;
  remember_last_vault(vault_id: VaultId): Promise<void>;
  get_last_vault_id(): Promise<VaultId | null>;
}

export interface VaultSettingsPort {
  get_vault_setting<T>(vault_id: VaultId, key: string): Promise<T | null>;
  set_vault_setting(
    vault_id: VaultId,
    key: string,
    value: unknown,
  ): Promise<void>;
}
