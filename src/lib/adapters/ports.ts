import { create_console_telemetry_adapter } from '$lib/adapters/telemetry/console_telemetry_adapter'
import { is_tauri } from '$lib/adapters/detect_platform'
import { create_navigation_adapter } from '$lib/adapters/navigation/navigation_adapter'
import { create_assets_tauri_adapter } from '$lib/adapters/tauri/assets_tauri_adapter'
import { create_notes_tauri_adapter } from '$lib/adapters/tauri/notes_tauri_adapter'
import { create_vault_tauri_adapter } from '$lib/adapters/tauri/vault_tauri_adapter'
import { create_watcher_tauri_adapter } from '$lib/adapters/tauri/watcher_tauri_adapter'
import { create_workspace_index_tauri_adapter } from '$lib/adapters/tauri/workspace_index_tauri_adapter'
import { create_assets_web_adapter } from '$lib/adapters/web/assets_web_adapter'
import { create_notes_web_adapter } from '$lib/adapters/web/notes_web_adapter'
import { create_vault_web_adapter } from '$lib/adapters/web/vault_web_adapter'
import { create_watcher_web_adapter } from '$lib/adapters/web/watcher_web_adapter'
import { create_workspace_index_web_adapter } from '$lib/adapters/web/workspace_index_web_adapter'
import type { SettingsPort } from '$lib/ports/settings_port'

const settings_stub: SettingsPort = {
  async get_setting<T>(_key: string): Promise<T | null> {
    return null
  },
  async set_setting<T>(_key: string, _value: T) {}
}

export const ports = {
  vault: is_tauri ? create_vault_tauri_adapter() : create_vault_web_adapter(),
  notes: is_tauri ? create_notes_tauri_adapter() : create_notes_web_adapter(),
  index: is_tauri ? create_workspace_index_tauri_adapter() : create_workspace_index_web_adapter(),
  watcher: is_tauri ? create_watcher_tauri_adapter() : create_watcher_web_adapter(),
  settings: settings_stub,
  assets: is_tauri ? create_assets_tauri_adapter() : create_assets_web_adapter(),
  telemetry: create_console_telemetry_adapter(),
  navigation: create_navigation_adapter()
}
