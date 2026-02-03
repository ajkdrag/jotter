import { is_tauri } from '$lib/adapters/detect_platform'
import { create_assets_tauri_adapter } from '$lib/adapters/tauri/assets_tauri_adapter'
import { create_notes_tauri_adapter } from '$lib/adapters/tauri/notes_tauri_adapter'
import { create_vault_tauri_adapter } from '$lib/adapters/tauri/vault_tauri_adapter'
import { create_workspace_index_tauri_adapter } from '$lib/adapters/tauri/workspace_index_tauri_adapter'
import { create_settings_tauri_adapter } from '$lib/adapters/tauri/settings_tauri_adapter'
import { create_search_tauri_adapter } from '$lib/adapters/tauri/search_tauri_adapter'
import { create_assets_web_adapter } from '$lib/adapters/web/assets_web_adapter'
import { create_notes_web_adapter } from '$lib/adapters/web/notes_web_adapter'
import { create_vault_web_adapter } from '$lib/adapters/web/vault_web_adapter'
import { create_workspace_index_web_adapter } from '$lib/adapters/web/workspace_index_web_adapter'
import { create_settings_web_adapter } from '$lib/adapters/web/settings_web_adapter'
import { create_search_web_adapter } from '$lib/adapters/web/search_web_adapter'
import { create_theme_adapter } from '$lib/adapters/theme_adapter'
import type { AssetsPort } from '$lib/ports/assets_port'
import type { ClipboardPort } from '$lib/ports/clipboard_port'
import type { EditorPort } from '$lib/ports/editor_port'
import type { NotesPort } from '$lib/ports/notes_port'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { SearchPort } from '$lib/ports/search_port'
import type { ThemePort } from '$lib/ports/theme_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { VaultId } from '$lib/types/ids'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'
import { create_clipboard_web_adapter } from '$lib/adapters/web/clipboard_web_adapter'
import { create_clipboard_tauri_adapter } from '$lib/adapters/tauri/clipboard_tauri_adapter'

export type Ports = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
  search: SearchPort
  settings: SettingsPort
  assets: AssetsPort
  editor: EditorPort
  theme: ThemePort
  clipboard: ClipboardPort
}

export type CreateProdPortsInput = {
  get_notes_for_search?: (vault_id: VaultId) => NoteMeta[]
}

export function create_prod_ports(input?: CreateProdPortsInput): Ports {
  const search_port: SearchPort = is_tauri
    ? create_search_tauri_adapter()
    : create_search_web_adapter(input?.get_notes_for_search ?? (() => []))

  return {
    vault: is_tauri ? create_vault_tauri_adapter() : create_vault_web_adapter(),
    notes: is_tauri ? create_notes_tauri_adapter() : create_notes_web_adapter(),
    index: is_tauri ? create_workspace_index_tauri_adapter() : create_workspace_index_web_adapter(),
    search: search_port,
    settings: is_tauri ? create_settings_tauri_adapter() : create_settings_web_adapter(),
    assets: is_tauri ? create_assets_tauri_adapter() : create_assets_web_adapter(),
    editor: milkdown_editor_port,
    theme: create_theme_adapter(),
    clipboard: is_tauri ? create_clipboard_tauri_adapter() : create_clipboard_web_adapter()
  }
}
