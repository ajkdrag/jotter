import { create_console_telemetry_adapter } from '$lib/adapters/telemetry/console_telemetry_adapter'
import { create_assets_tauri_adapter } from '$lib/adapters/tauri/assets_tauri_adapter'
import { create_notes_tauri_adapter } from '$lib/adapters/tauri/notes_tauri_adapter'
import { create_vault_tauri_adapter } from '$lib/adapters/tauri/vault_tauri_adapter'
import { create_watcher_tauri_adapter } from '$lib/adapters/tauri/watcher_tauri_adapter'
import { create_workspace_index_tauri_adapter } from '$lib/adapters/tauri/workspace_index_tauri_adapter'
import type { SettingsPort } from '$lib/ports/settings_port'

const settings_stub: SettingsPort = {
  async get_setting<T>(_key: string): Promise<T | null> {
    return null
  },
  async set_setting<T>(_key: string, _value: T) {}
}

export const ports = {
  vault: create_vault_tauri_adapter(),
  notes: create_notes_tauri_adapter(),
  index: create_workspace_index_tauri_adapter(),
  watcher: create_watcher_tauri_adapter(),
  settings: settings_stub,
  assets: create_assets_tauri_adapter(),
  telemetry: create_console_telemetry_adapter()
}
