import { is_tauri } from '$lib/adapters/detect_platform'
import { create_assets_tauri_adapter } from '$lib/adapters/tauri/assets_tauri_adapter'
import { create_notes_tauri_adapter } from '$lib/adapters/tauri/notes_tauri_adapter'
import { create_vault_tauri_adapter } from '$lib/adapters/tauri/vault_tauri_adapter'
import { create_workspace_index_tauri_adapter } from '$lib/adapters/tauri/workspace_index_tauri_adapter'
import { create_settings_tauri_adapter } from '$lib/adapters/tauri/settings_tauri_adapter'
import { create_vault_settings_tauri_adapter } from '$lib/adapters/tauri/vault_settings_tauri_adapter'
import { create_search_tauri_adapter } from '$lib/adapters/tauri/search_tauri_adapter'
import { create_assets_web_adapter } from '$lib/adapters/web/assets_web_adapter'
import { create_notes_web_adapter } from '$lib/adapters/web/notes_web_adapter'
import { create_vault_web_adapter } from '$lib/adapters/web/vault_web_adapter'
import { create_workspace_index_web_adapter } from '$lib/adapters/web/workspace_index_web_adapter'
import { create_settings_web_adapter } from '$lib/adapters/web/settings_web_adapter'
import { create_vault_settings_web_adapter } from '$lib/adapters/web/vault_settings_web_adapter'
import { create_search_web_adapter } from '$lib/adapters/web/search_web_adapter'
import { create_theme_adapter } from '$lib/adapters/theme_adapter'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'
import { create_clipboard_web_adapter } from '$lib/adapters/web/clipboard_web_adapter'
import { create_clipboard_tauri_adapter } from '$lib/adapters/tauri/clipboard_tauri_adapter'
import type { Ports } from '$lib/ports/ports'
import { create_search_index_web } from '$lib/adapters/web/search_index_web'

export function create_prod_ports(): Ports {
  if (is_tauri) {
    return {
      vault: create_vault_tauri_adapter(),
      notes: create_notes_tauri_adapter(),
      index: create_workspace_index_tauri_adapter(),
      search: create_search_tauri_adapter(),
      settings: create_settings_tauri_adapter(),
      vault_settings: create_vault_settings_tauri_adapter(),
      assets: create_assets_tauri_adapter(),
      editor: milkdown_editor_port,
      theme: create_theme_adapter(),
      clipboard: create_clipboard_tauri_adapter()
    }
  }

  const notes = create_notes_web_adapter()
  const search_index = create_search_index_web()

  return {
    vault: create_vault_web_adapter(),
    notes,
    index: create_workspace_index_web_adapter(notes, search_index),
    search: create_search_web_adapter(search_index),
    settings: create_settings_web_adapter(),
    vault_settings: create_vault_settings_web_adapter(),
    assets: create_assets_web_adapter(),
    editor: milkdown_editor_port,
    theme: create_theme_adapter(),
    clipboard: create_clipboard_web_adapter()
  }
}
