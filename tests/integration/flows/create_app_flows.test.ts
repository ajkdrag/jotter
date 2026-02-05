import { describe, it, expect, vi } from 'vitest'
import { create_app_flows } from '$lib/flows/create_app_flows'
import { create_mock_notes_port, create_mock_index_port, create_mock_vault_port } from '../../unit/helpers/mock_ports'
import { create_test_assets_adapter } from '$lib/adapters/test/test_assets_adapter'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { create_test_vault_settings_adapter } from '$lib/adapters/test/test_vault_settings_adapter'
import { create_test_vault_adapter } from '$lib/adapters/test/test_vault_adapter'
import { create_test_notes_adapter } from '$lib/adapters/test/test_notes_adapter'
import { create_test_workspace_index_adapter } from '$lib/adapters/test/test_workspace_index_adapter'
import { create_test_search_adapter } from '$lib/adapters/test/test_search_adapter'
import { create_theme_adapter } from '$lib/adapters/theme_adapter'
import { create_test_clipboard_adapter } from '$lib/adapters/test/test_clipboard_adapter'
import { as_vault_id, as_vault_path } from '$lib/types/ids'
import type { Ports } from '$lib/ports/ports'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'

describe('create_app_flows', () => {
  it('returns handles for all flows', () => {
    const ports: Ports = {
      vault: create_test_vault_adapter(),
      notes: create_test_notes_adapter(),
      index: create_test_workspace_index_adapter(),
      search: create_test_search_adapter(),
      settings: create_test_settings_adapter(),
      vault_settings: create_test_vault_settings_adapter(),
      assets: create_test_assets_adapter(),
      editor: milkdown_editor_port,
      theme: create_theme_adapter(),
      clipboard: create_test_clipboard_adapter()
    }

    const app_flows = create_app_flows(ports)

    expect(app_flows.flows.preferences_initialization).toBeDefined()
    expect(app_flows.flows.vault_bootstrap).toBeDefined()
    expect(app_flows.flows.change_vault).toBeDefined()
    expect(app_flows.flows.open_note).toBeDefined()
    expect(app_flows.flows.delete_note).toBeDefined()
    expect(app_flows.flows.rename_note).toBeDefined()
    expect(app_flows.flows.delete_folder).toBeDefined()
    expect(app_flows.flows.rename_folder).toBeDefined()
    expect(app_flows.flows.save_note).toBeDefined()
    expect(app_flows.flows.create_folder).toBeDefined()
    expect(app_flows.flows.settings).toBeDefined()
    expect(app_flows.flows.command_palette).toBeDefined()
    expect(app_flows.flows.file_search).toBeDefined()
    expect(app_flows.flows.filetree).toBeDefined()
    expect(app_flows.flows.clipboard).toBeDefined()
    expect(app_flows.flows.theme).toBeDefined()
    expect(app_flows.stores).toBeDefined()
  })

  it('dispatches VAULT_CHANGED to filetree when vault changes', async () => {
    const ports: Ports = {
      vault: create_mock_vault_port(),
      notes: create_mock_notes_port(),
      index: create_mock_index_port(),
      search: create_test_search_adapter(),
      settings: create_test_settings_adapter(),
      vault_settings: create_test_vault_settings_adapter(),
      assets: create_test_assets_adapter(),
      editor: milkdown_editor_port,
      theme: create_theme_adapter(),
      clipboard: create_test_clipboard_adapter()
    }

    const app_flows = create_app_flows(ports)
    const filetree_spy = vi.spyOn(app_flows.flows.filetree, 'send')

    const vault = { id: as_vault_id('vault-1'), name: 'Vault', path: as_vault_path('/vault'), created_at: 0 }
    app_flows.stores.vault.actions.set_vault(vault)

    await vi.waitUntil(() => filetree_spy.mock.calls.length > 0)
    expect(filetree_spy).toHaveBeenCalledWith({ type: 'VAULT_CHANGED' })
  })
})
