import { describe, expect, it } from 'vitest'
import { SearchStore } from '$lib/stores/search_store.svelte'
import type { NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OmnibarItem, InFileMatch } from '$lib/types/search'

function note(path: string): NoteMeta {
  return {
    id: path as NoteId,
    path: path as NotePath,
    title: path.split('/').pop()?.replace('.md', '') ?? '',
    mtime_ms: 0,
    size_bytes: 0
  }
}

describe('SearchStore', () => {
  it('sets and clears omnibar items', () => {
    const store = new SearchStore()
    const items: OmnibarItem[] = [{ kind: 'note', note: note('a.md'), score: 1 }]

    store.set_omnibar_items(items)
    expect(store.omnibar_items).toEqual(items)

    store.clear_omnibar()
    expect(store.omnibar_items).toEqual([])
  })

  it('adds recent notes with deduplication and max 10 cap', () => {
    const store = new SearchStore()

    store.add_recent_note('a.md' as NoteId)
    store.add_recent_note('b.md' as NoteId)
    store.add_recent_note('a.md' as NoteId)

    expect(store.recent_note_ids).toEqual(['a.md', 'b.md'])

    for (let i = 0; i < 12; i++) {
      store.add_recent_note(`note-${String(i)}.md` as NoteId)
    }
    expect(store.recent_note_ids).toHaveLength(10)
    expect(store.recent_note_ids[0]).toBe('note-11.md')
  })

  it('sets and clears in-file matches', () => {
    const store = new SearchStore()
    const matches: InFileMatch[] = [{ line: 1, column: 5, length: 3, context: 'foo bar baz' }]

    store.set_in_file_matches(matches)
    expect(store.in_file_matches).toEqual(matches)

    store.clear_in_file_matches()
    expect(store.in_file_matches).toEqual([])
  })

  it('resets all state', () => {
    const store = new SearchStore()

    store.set_omnibar_items([{ kind: 'note', note: note('a.md'), score: 1 }])
    store.add_recent_note('b.md' as NoteId)
    store.set_in_file_matches([{ line: 1, column: 0, length: 2, context: 'hi' }])

    store.reset()

    expect(store.omnibar_items).toEqual([])
    expect(store.recent_note_ids).toEqual([])
    expect(store.in_file_matches).toEqual([])
  })
})
