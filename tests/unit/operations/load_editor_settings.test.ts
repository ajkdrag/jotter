import { describe, it, expect } from 'vitest'
import { load_editor_settings, save_editor_settings } from '$lib/operations/load_editor_settings'
import { create_test_vault_settings_adapter } from '$lib/adapters/test/test_vault_settings_adapter'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { DEFAULT_EDITOR_SETTINGS, SETTINGS_KEY } from '$lib/types/editor_settings'
import { as_vault_id } from '$lib/types/ids'

const TEST_VAULT_ID = as_vault_id('test-vault-id')

describe('load_editor_settings', () => {
  it('returns defaults when no stored settings', async () => {
    const vault_settings_port = create_test_vault_settings_adapter()

    const result = await load_editor_settings(vault_settings_port, TEST_VAULT_ID)

    expect(result).toEqual(DEFAULT_EDITOR_SETTINGS)
  })

  it('returns stored settings when present', async () => {
    const vault_settings_port = create_test_vault_settings_adapter()
    await save_editor_settings(vault_settings_port, TEST_VAULT_ID, { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.5 })

    const result = await load_editor_settings(vault_settings_port, TEST_VAULT_ID)

    expect(result.font_size).toBe(1.5)
  })

  it('migrates from legacy settings when vault settings empty', async () => {
    const vault_settings_port = create_test_vault_settings_adapter()
    const legacy_settings_port = create_test_settings_adapter()
    await legacy_settings_port.set_setting(SETTINGS_KEY, { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.75 })

    const result = await load_editor_settings(vault_settings_port, TEST_VAULT_ID, legacy_settings_port)

    expect(result.font_size).toBe(1.75)
    const migrated = await vault_settings_port.get_vault_setting(TEST_VAULT_ID, SETTINGS_KEY)
    expect(migrated).not.toBeNull()
  })

  it('does not migrate if vault settings exist', async () => {
    const vault_settings_port = create_test_vault_settings_adapter()
    const legacy_settings_port = create_test_settings_adapter()
    await vault_settings_port.set_vault_setting(TEST_VAULT_ID, SETTINGS_KEY, { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.25 })
    await legacy_settings_port.set_setting(SETTINGS_KEY, { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.75 })

    const result = await load_editor_settings(vault_settings_port, TEST_VAULT_ID, legacy_settings_port)

    expect(result.font_size).toBe(1.25)
  })
})
