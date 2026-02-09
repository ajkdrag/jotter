import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { VaultId } from "$lib/types/ids";

export function create_test_vault_settings_adapter(): VaultSettingsPort {
  const storage = new Map<string, Map<string, unknown>>();

  function get_vault_storage(vault_id: VaultId): Map<string, unknown> {
    let vault_storage = storage.get(vault_id);
    if (!vault_storage) {
      vault_storage = new Map();
      storage.set(vault_id, vault_storage);
    }
    return vault_storage;
  }

  return {
    get_vault_setting<T>(vault_id: VaultId, key: string): Promise<T | null> {
      const vault_storage = get_vault_storage(vault_id);
      const value = vault_storage.get(key);
      return Promise.resolve(value !== undefined ? (value as T) : null);
    },

    set_vault_setting(
      vault_id: VaultId,
      key: string,
      value: unknown,
    ): Promise<void> {
      const vault_storage = get_vault_storage(vault_id);
      vault_storage.set(key, value);
      return Promise.resolve();
    },
  };
}
