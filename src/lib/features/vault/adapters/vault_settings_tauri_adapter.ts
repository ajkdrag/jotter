import type { VaultSettingsPort } from "$lib/features/vault/ports";
import type { VaultId } from "$lib/shared/types/ids";
import { tauri_invoke } from "$lib/shared/adapters/tauri_invoke";

async function get_nullable_vault_setting<T>(
  vault_id: VaultId,
  key: string,
): Promise<T | null> {
  const value = await tauri_invoke<T | null>("get_vault_setting", {
    vaultId: vault_id,
    key,
  });
  return value ?? null;
}

export function create_vault_settings_tauri_adapter(): VaultSettingsPort {
  return {
    async get_vault_setting<T>(
      vault_id: VaultId,
      key: string,
    ): Promise<T | null> {
      return get_nullable_vault_setting<T>(vault_id, key);
    },

    async set_vault_setting(
      vault_id: VaultId,
      key: string,
      value: unknown,
    ): Promise<void> {
      await tauri_invoke<undefined>("set_vault_setting", {
        vaultId: vault_id,
        key,
        value,
      });
    },
  };
}
