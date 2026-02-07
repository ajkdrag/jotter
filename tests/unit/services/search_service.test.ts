import { describe, expect, it, vi } from 'vitest'
import { SearchService } from '$lib/services/search_service'
import { VaultStore } from '$lib/stores/vault_store.svelte'
import { UIStore } from '$lib/stores/ui_store.svelte'
import { OpStore } from '$lib/stores/op_store.svelte'
import { as_note_path } from '$lib/types/ids'
import { create_test_vault } from '../helpers/test_fixtures'

describe('SearchService', () => {
  it('searches notes and updates file search state', async () => {
    const search_port = {
      search_notes: vi.fn().mockResolvedValue([
        {
          note: {
            id: as_note_path('docs/a.md'),
            path: as_note_path('docs/a.md'),
            title: 'a',
            mtime_ms: 0,
            size_bytes: 0
          },
          score: 1,
          snippet: 'match'
        }
      ])
    }

    const vault_store = new VaultStore()
    vault_store.set_vault(create_test_vault())

    const ui_store = new UIStore()
    const op_store = new OpStore()

    const service = new SearchService(search_port, vault_store, ui_store, op_store)

    service.open_file_search()
    await service.set_file_search_query('alpha')

    expect(search_port.search_notes).toHaveBeenCalledTimes(1)
    expect(ui_store.file_search.results.length).toBe(1)
    expect(ui_store.file_search.is_searching).toBe(false)
    expect(op_store.get('search.notes').status).toBe('success')
  })

  it('adds recent notes and closes file search on confirm', () => {
    const search_port = {
      search_notes: vi.fn().mockResolvedValue([])
    }

    const vault_store = new VaultStore()
    const ui_store = new UIStore()
    const op_store = new OpStore()

    const service = new SearchService(search_port, vault_store, ui_store, op_store)

    service.confirm_file_search_note(as_note_path('docs/a.md'))

    expect(ui_store.file_search.recent_note_ids).toEqual([as_note_path('docs/a.md')])
    expect(ui_store.file_search.open).toBe(false)
  })
})
