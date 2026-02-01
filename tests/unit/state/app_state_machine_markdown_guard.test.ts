import { describe, it, expect } from 'vitest'
import { update_markdown, update_dirty_state } from '$lib/state/app_state_machine'

describe('app_state_machine update guards', () => {
  it('update_markdown returns context when no open note', () => {
    const context = {
      vault: null,
      recent_vaults: [],
      notes: [],
      folder_paths: [],
      open_note: null,
      theme: 'system' as const,
      sidebar_open: true,
      selected_folder_path: '',
      now_ms: () => 0
    }

    const result = update_markdown(context, 'updated' as never)
    expect(result).toBe(context)
  })

  it('update_dirty_state returns context when no open note', () => {
    const context = {
      vault: null,
      recent_vaults: [],
      notes: [],
      folder_paths: [],
      open_note: null,
      theme: 'system' as const,
      sidebar_open: true,
      selected_folder_path: '',
      now_ms: () => 0
    }

    const result = update_dirty_state(context, true)
    expect(result).toBe(context)
  })
})
