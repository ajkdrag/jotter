import { describe, it, expect } from 'vitest'
import { create_search_index_web } from '$lib/adapters/web/search_index_web'
import { as_markdown_text, as_note_path, as_vault_id } from '$lib/types/ids'
import type { NoteDoc } from '$lib/types/note'

function build_doc(path: string, title: string, markdown: string): NoteDoc {
  const note_path = as_note_path(path)
  return {
    meta: {
      id: note_path,
      path: note_path,
      title,
      mtime_ms: 0,
      size_bytes: markdown.length
    },
    markdown: as_markdown_text(markdown)
  }
}

describe('search_index_web', () => {
  it('build_index indexes body, path, and title', () => {
    const index = create_search_index_web()
    const vault_id = as_vault_id('vault-1')
    const docs = [
      build_doc('alpha.md', 'Alpha Note', 'the quick brown fox'),
      build_doc('beta.md', 'Beta Note', 'lorem ipsum')
    ]

    index.build_index(vault_id, docs)

    const content_results = index.search(
      vault_id,
      { raw: 'content: fox', text: 'fox', scope: 'content', domain: 'notes' },
      10
    )
    expect(content_results[0]?.note.path).toBe(as_note_path('alpha.md'))

    const path_results = index.search(
      vault_id,
      { raw: 'path: beta', text: 'beta', scope: 'path', domain: 'notes' },
      10
    )
    expect(path_results[0]?.note.path).toBe(as_note_path('beta.md'))

    const title_results = index.search(
      vault_id,
      { raw: 'title: alpha', text: 'alpha', scope: 'title', domain: 'notes' },
      10
    )
    expect(title_results[0]?.note.title).toBe('Alpha Note')
  })

  it('adds snippet for content queries', () => {
    const index = create_search_index_web()
    const vault_id = as_vault_id('vault-1')
    const docs = [build_doc('gamma.md', 'Gamma', 'snippets should include match')]

    index.build_index(vault_id, docs)

    const results = index.search(
      vault_id,
      { raw: 'content: match', text: 'match', scope: 'content', domain: 'notes' },
      10
    )
    expect(results[0]?.snippet).toBeDefined()
  })
})
