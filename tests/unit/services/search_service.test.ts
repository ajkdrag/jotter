import { describe, expect, it, vi } from 'vitest'
import { SearchService } from '$lib/services/search_service'
import { VaultStore } from '$lib/stores/vault_store.svelte'
import { OpStore } from '$lib/stores/op_store.svelte'
import { as_note_path } from '$lib/types/ids'
import { create_test_vault } from '../helpers/test_fixtures'

describe('SearchService', () => {
  it('searches notes and returns results', async () => {
    const search_port = {
      suggest_wiki_links: vi.fn().mockResolvedValue([]),
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

    const op_store = new OpStore()

    const service = new SearchService(search_port, vault_store, op_store)

    const result = await service.search_notes('alpha')

    expect(search_port.search_notes).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.results.length).toBe(1)
    }
    expect(op_store.get('search.notes').status).toBe('success')
  })

  it('returns empty result and resets op for empty query', async () => {
    const search_port = {
      suggest_wiki_links: vi.fn().mockResolvedValue([]),
      search_notes: vi.fn().mockResolvedValue([])
    }

    const vault_store = new VaultStore()
    const op_store = new OpStore()

    const service = new SearchService(search_port, vault_store, op_store)

    op_store.start('search.notes')
    const result = await service.search_notes('  ')

    expect(result).toEqual({
      status: 'empty',
      results: []
    })
    expect(search_port.search_notes).not.toHaveBeenCalled()
    expect(op_store.get('search.notes').status).toBe('idle')
  })
})
