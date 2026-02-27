import type { SettingsPort } from "$lib/ports/settings_port";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";

async function get_nullable_setting<T>(key: string): Promise<T | null> {
  const value = await tauri_invoke<T | null>("get_setting", { key });
  return value ?? null;
}

export function create_settings_tauri_adapter(): SettingsPort {
  return {
    async get_setting<T>(key: string): Promise<T | null> {
      return get_nullable_setting<T>(key);
    },

    async set_setting(key: string, value: unknown): Promise<void> {
      await tauri_invoke<undefined>("set_setting", { key, value });
    },
  };
}
