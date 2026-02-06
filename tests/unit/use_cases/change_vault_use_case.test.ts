import { describe, expect, it } from 'vitest'
import { change_vault_use_case } from '$lib/use_cases/change_vault_use_case'
import { as_markdown_text, as_vault_id, as_vault_path } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'

describe('change_vault_use_case', () => {
  it('emits clear-first events before applying the new vault snapshot', async () => {
    const vault: Vault = {
      id: as_vault_id('vault-1'),
      name: 'Vault',
      path: as_vault_path('/vault'),
      created_at: 0
    }

    const events = await change_vault_use_case(
      {
        vault: {
          choose_vault: () => Promise.resolve(null),
          open_vault: () => Promise.resolve(vault),
          open_vault_by_id: () => Promise.resolve(vault),
          list_vaults: () => Promise.resolve([vault]),
          remember_last_vault: () => Promise.resolve(),
          get_last_vault_id: () => Promise.resolve(null)
        },
        notes: {
          list_notes: () => Promise.resolve([]),
          list_folders: () => Promise.resolve([]),
          read_note: (_vault_id, note_id) => Promise.resolve({
            meta: { id: note_id, path: note_id, title: '', mtime_ms: 0, size_bytes: 0 },
            markdown: as_markdown_text('')
          }),
          write_note: () => Promise.resolve(),
          create_note: (_vault_id, note_path) => Promise.resolve({
            id: note_path,
            path: note_path,
            title: '',
            mtime_ms: 0,
            size_bytes: 0
          }),
          delete_note: () => Promise.resolve(),
          rename_note: () => Promise.resolve(),
          create_folder: () => Promise.resolve(),
          rename_folder: () => Promise.resolve(),
          delete_folder: () => Promise.resolve({ deleted_notes: [], deleted_folders: [] }),
          list_folder_contents: () => Promise.resolve({ notes: [], subfolders: [] }),
          get_folder_stats: () => Promise.resolve({ note_count: 0, folder_count: 0 })
        },
        index: {
          build_index: () => Promise.resolve(),
          upsert_note: () => Promise.resolve(),
          remove_note: () => Promise.resolve()
        }
      },
      { vault_path: as_vault_path('/vault') },
      123
    )

    expect(events.slice(0, 4)).toEqual([
      { type: 'vault_cleared' },
      { type: 'notes_set', notes: [] },
      { type: 'folders_set', folder_paths: [] },
      { type: 'open_note_cleared' }
    ])
    const vault_set_index = events.findIndex((event) => event.type === 'vault_set')
    const clear_index = events.findIndex((event) => event.type === 'vault_cleared')
    expect(clear_index).toBeGreaterThanOrEqual(0)
    expect(vault_set_index).toBeGreaterThan(clear_index)
    expect(events.some((event) => event.type === 'open_note_set')).toBe(true)
    expect(events.some((event) => event.type === 'vault_set' && event.vault.id === vault.id)).toBe(true)
  })
})
