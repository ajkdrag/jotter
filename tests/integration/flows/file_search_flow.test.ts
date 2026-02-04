import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import { file_search_flow_machine } from '$lib/flows/file_search_flow'
import type { SearchPort } from '$lib/ports/search_port'
import { as_note_path, as_vault_id } from '$lib/types/ids'
import type { NoteSearchHit, SearchQuery } from '$lib/types/search'
import type { VaultId } from '$lib/types/ids'

function build_hit(path: string, snippet?: string): NoteSearchHit {
  const note_path = as_note_path(path)
  return {
    note: {
      id: note_path,
      path: note_path,
      title: 'Note',
      mtime_ms: 0,
      size_bytes: 0
    },
    score: 1,
    snippet
  }
}

describe('file_search_flow', () => {
  it('parses scope tokens for search', async () => {
    const calls: Array<{ scope: string; text: string }> = []
    const search: SearchPort = {
      search_notes: vi.fn((_vault_id: VaultId, query: SearchQuery) => {
        calls.push({ scope: query.scope, text: query.text })
        return Promise.resolve([])
      })
    }

    const actor = createActor(file_search_flow_machine, {
      input: {
        ports: { search },
        get_vault_id: () => as_vault_id('vault-1')
      }
    }).start()

    actor.send({ type: 'OPEN' })
    actor.send({ type: 'SET_QUERY', query: 'path: foo' })

    await vi.waitUntil(() => calls.length > 0)
    expect(calls[0]).toEqual({ scope: 'path', text: 'foo' })
    actor.stop()
  })

  it('keeps snippets from search results', async () => {
    const search: SearchPort = {
      search_notes: vi.fn(() => Promise.resolve([build_hit('note.md', 'matched snippet')]))
    }

    const actor = createActor(file_search_flow_machine, {
      input: {
        ports: { search },
        get_vault_id: () => as_vault_id('vault-1')
      }
    }).start()

    actor.send({ type: 'OPEN' })
    actor.send({ type: 'SET_QUERY', query: 'content: match' })

    await vi.waitUntil(() => actor.getSnapshot().context.results.length > 0)
    expect(actor.getSnapshot().context.results[0]?.snippet).toBe('matched snippet')
    actor.stop()
  })
})
