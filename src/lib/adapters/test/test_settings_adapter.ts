import type { SettingsPort } from "$lib/ports/settings_port";

export function create_test_settings_adapter(): SettingsPort {
  const storage = new Map<string, unknown>();

  return {
    get_setting<T>(key: string): Promise<T | null> {
      const value = storage.get(key);
      return Promise.resolve(value !== undefined ? (value as T) : null);
    },
    set_setting(key: string, value: unknown): Promise<void> {
      storage.set(key, value);
      return Promise.resolve();
    },
  };
}
