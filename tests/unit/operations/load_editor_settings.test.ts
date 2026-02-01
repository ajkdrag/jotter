import { describe, it, expect } from 'vitest'
import { load_editor_settings, save_editor_settings } from '$lib/operations/load_editor_settings'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

describe('load_editor_settings', () => {
  it('returns defaults when no stored settings', async () => {
    const settings_port = create_test_settings_adapter()

    const result = await load_editor_settings(settings_port)

    expect(result).toEqual(DEFAULT_EDITOR_SETTINGS)
  })

  it('returns stored settings when present', async () => {
    const settings_port = create_test_settings_adapter()
    await save_editor_settings(settings_port, { ...DEFAULT_EDITOR_SETTINGS, font_size: 1.5 })

    const result = await load_editor_settings(settings_port)

    expect(result.font_size).toBe(1.5)
  })
})
