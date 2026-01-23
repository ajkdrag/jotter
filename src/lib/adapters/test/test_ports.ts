import { create_navigation_adapter } from '$lib/adapters/navigation/navigation_adapter'
import { create_test_assets_adapter } from './test_assets_adapter'
import { create_test_notes_adapter } from './test_notes_adapter'
import { create_test_vault_adapter } from './test_vault_adapter'
import { create_test_workspace_index_adapter } from './test_workspace_index_adapter'
import type { Ports } from '$lib/adapters/create_prod_ports'
import type { SettingsPort } from '$lib/ports/settings_port'

const settings_stub: SettingsPort = {
  async get_setting<T>(_key: string): Promise<T | null> {
    return null
  },
  async set_setting<T>(_key: string, _value: T) {}
}

export function create_test_ports(): Ports {
  return {
    vault: create_test_vault_adapter(),
    notes: create_test_notes_adapter(),
    index: create_test_workspace_index_adapter(),
    settings: settings_stub,
    assets: create_test_assets_adapter(),
    navigation: create_navigation_adapter()
  }
}
