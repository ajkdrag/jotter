import { is_tauri } from '$lib/adapters/detect_platform'
import { create_assets_tauri_adapter } from '$lib/adapters/tauri/assets_tauri_adapter'
import { create_notes_tauri_adapter } from '$lib/adapters/tauri/notes_tauri_adapter'
import { create_vault_tauri_adapter } from '$lib/adapters/tauri/vault_tauri_adapter'
import { create_workspace_index_tauri_adapter } from '$lib/adapters/tauri/workspace_index_tauri_adapter'
import { create_assets_web_adapter } from '$lib/adapters/web/assets_web_adapter'
import { create_notes_web_adapter } from '$lib/adapters/web/notes_web_adapter'
import { create_vault_web_adapter } from '$lib/adapters/web/vault_web_adapter'
import { create_workspace_index_web_adapter } from '$lib/adapters/web/workspace_index_web_adapter'
import type { AssetsPort } from '$lib/ports/assets_port'
import type { EditorPort } from '$lib/ports/editor_port'
import type { NotesPort } from '$lib/ports/notes_port'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'

const settings_stub: SettingsPort = {
  async get_setting<T>(_key: string): Promise<T | null> {
    return null
  },
  async set_setting<T>(_key: string, _value: T) {}
}

export type Ports = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
  settings: SettingsPort
  assets: AssetsPort
  editor: EditorPort
}

export function create_prod_ports(): Ports {
  return {
    vault: is_tauri ? create_vault_tauri_adapter() : create_vault_web_adapter(),
    notes: is_tauri ? create_notes_tauri_adapter() : create_notes_web_adapter(),
    index: is_tauri ? create_workspace_index_tauri_adapter() : create_workspace_index_web_adapter(),
    settings: settings_stub,
    assets: is_tauri ? create_assets_tauri_adapter() : create_assets_web_adapter(),
    editor: milkdown_editor_port
  }
}
