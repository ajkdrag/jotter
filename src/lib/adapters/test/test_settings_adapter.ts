import type { SettingsPort } from "$lib/ports/settings_port";

export function create_test_settings_adapter(): SettingsPort {
  const storage = new Map<string, unknown>();

  return {
    async get_setting<T>(key: string): Promise<T | null> {
      const value = storage.get(key);
      return value !== undefined ? (value as T) : null;
    },
    async set_setting<T>(key: string, value: T): Promise<void> {
      storage.set(key, value);
    },
  };
}
