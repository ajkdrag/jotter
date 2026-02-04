import { describe, it, expect } from 'vitest'
import { save_editor_settings, load_editor_settings } from '$lib/operations/load_editor_settings'
import { create_test_vault_settings_adapter } from '$lib/adapters/test/test_vault_settings_adapter'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'
import { as_vault_id } from '$lib/types/ids'

const TEST_VAULT_ID = as_vault_id('test-vault-id')

describe('save_editor_settings', () => {
  it('persists settings to port', async () => {
    const vault_settings_port = create_test_vault_settings_adapter()
    const updated = { ...DEFAULT_EDITOR_SETTINGS, line_height: 2 }

    await save_editor_settings(vault_settings_port, TEST_VAULT_ID, updated)
    const stored = await load_editor_settings(vault_settings_port, TEST_VAULT_ID)

    expect(stored.line_height).toBe(2)
  })
})
