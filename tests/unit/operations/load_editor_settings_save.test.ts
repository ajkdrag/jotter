import { describe, it, expect } from 'vitest'
import { save_editor_settings, load_editor_settings } from '$lib/operations/load_editor_settings'
import { create_test_settings_adapter } from '$lib/adapters/test/test_settings_adapter'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

describe('save_editor_settings', () => {
  it('persists settings to port', async () => {
    const settings_port = create_test_settings_adapter()
    const updated = { ...DEFAULT_EDITOR_SETTINGS, line_height: 2 }

    await save_editor_settings(settings_port, updated)
    const stored = await load_editor_settings(settings_port)

    expect(stored.line_height).toBe(2)
  })
})
