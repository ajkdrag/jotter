import type { SettingsPort } from '$lib/ports/settings_port'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'

export function create_settings_tauri_adapter(): SettingsPort {
  return {
    async get_setting<T>(key: string): Promise<T | null> {
      const value = await tauri_invoke<T | null>('get_setting', { args: { key } })
      return value ?? null
    },

    async set_setting<T>(key: string, value: T): Promise<void> {
      await tauri_invoke<void>('set_setting', { args: { key, value } })
    }
  }
}
