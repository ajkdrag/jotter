import type { VaultId } from "$lib/types/ids";

export interface VaultSettingsPort {
  get_vault_setting<T>(vault_id: VaultId, key: string): Promise<T | null>;
  set_vault_setting(
    vault_id: VaultId,
    key: string,
    value: unknown,
  ): Promise<void>;
}
