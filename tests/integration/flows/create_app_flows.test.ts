import { describe, it, expect } from 'vitest'
import { create_app_flows } from '$lib/flows/create_app_flows'
import { create_mock_vault_port } from '../../unit/helpers/mock_ports'
import { create_test_assets_adapter } from '$lib/adapters/test/test_assets_adapter'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { create_test_vault_settings_adapter } from '$lib/adapters/test/test_vault_settings_adapter'
import { create_test_notes_adapter } from '$lib/adapters/test/test_notes_adapter'
import { create_test_search_adapter } from '$lib/adapters/test/test_search_adapter'
import { create_theme_adapter } from '$lib/adapters/theme_adapter'
import { create_test_clipboard_adapter } from '$lib/adapters/test/test_clipboard_adapter'
import type { Ports } from '$lib/ports/ports'
import { milkdown_editor_port } from '$lib/adapters/editor/milkdown_adapter'
import { create_app_stores } from '$lib/stores/create_app_stores'
import { create_event_bus } from '$lib/events/event_bus'
import type { EditorRuntime } from '$lib/shell/editor_runtime'

const editor_runtime_stub: EditorRuntime = {
  mount: async () => {},
  unmount: () => {},
  open_buffer: async () => {},
  apply_settings: async () => {},
  insert_text: () => {},
  mark_clean: () => {},
  flush: () => null,
  focus: () => {}
}

describe('create_app_flows', () => {
  it('returns handles for all flows', () => {
    const ports: Ports = {
      vault: create_mock_vault_port(),
      notes: create_test_notes_adapter(),
      index: create_test_search_adapter() as never,
      search: create_test_search_adapter(),
      settings: create_test_settings_adapter(),
      vault_settings: create_test_vault_settings_adapter(),
      assets: create_test_assets_adapter(),
      editor: milkdown_editor_port,
      theme: create_theme_adapter(),
      clipboard: create_test_clipboard_adapter()
    }

    const stores = create_app_stores()
    const event_bus = create_event_bus(stores)
    const app_flows = create_app_flows({
      ports,
      stores,
      dispatch: event_bus.dispatch,
      dispatch_many: event_bus.dispatch_many,
      now_ms: stores.now_ms,
      editor_runtime: editor_runtime_stub
    })

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
})
