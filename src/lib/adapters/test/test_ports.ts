import { create_test_assets_adapter } from './test_assets_adapter'
import { create_test_notes_adapter } from './test_notes_adapter'
import { create_test_vault_adapter } from './test_vault_adapter'
import { create_test_workspace_index_adapter } from './test_workspace_index_adapter'
import type { Ports } from '$lib/adapters/create_prod_ports'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/state/app_state_machine'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'

const settings_stub: SettingsPort = {
  async get_setting<T>(_key: string): Promise<T | null> {
    return null
  },
  async set_setting<T>(_key: string, _value: T) {}
}

const theme_stub: ThemePort = {
  get_theme(): ThemeMode {
    return 'system'
  },
  set_theme(_mode: ThemeMode): void {},
  get_resolved_theme(): 'light' | 'dark' {
    return 'light'
  }
}

export function create_test_ports(): Ports {
  return {
    vault: create_test_vault_adapter(),
    notes: create_test_notes_adapter(),
    index: create_test_workspace_index_adapter(),
    settings: settings_stub,
    assets: create_test_assets_adapter(),
    editor: milkdown_editor_port,
    theme: theme_stub
  }
}
