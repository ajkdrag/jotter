import { create_test_assets_adapter } from './test_assets_adapter'
import { create_test_notes_adapter } from './test_notes_adapter'
import { create_test_vault_adapter } from './test_vault_adapter'
import { create_test_workspace_index_adapter } from './test_workspace_index_adapter'
import { create_test_settings_adapter } from './test_settings_adapter'
import { create_test_search_adapter } from './test_search_adapter'
import { create_theme_adapter } from '$lib/adapters/theme_adapter'
import type { Ports } from '$lib/adapters/create_prod_ports'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'
import { create_test_clipboard_adapter } from '$lib/adapters/test/test_clipboard_adapter'

export function create_test_ports(): Ports {
  return {
    vault: create_test_vault_adapter(),
    notes: create_test_notes_adapter(),
    index: create_test_workspace_index_adapter(),
    search: create_test_search_adapter(),
    settings: create_test_settings_adapter(),
    assets: create_test_assets_adapter(),
    editor: milkdown_editor_port,
    theme: create_theme_adapter(),
    clipboard: create_test_clipboard_adapter()
  }
}
