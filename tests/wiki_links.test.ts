import { describe, expect, test } from 'vitest'
import { parse_wiki_links, resolve_wiki_link, suggest_note_path_for_token } from '$lib/utils/wiki_links'
import type { NoteMeta } from '$lib/types/note'

describe('wiki_links', () => {
  test('parse_wiki_links extracts tokens', () => {
    const md = [
      'Hello [[One]]',
      'Alias [[Two|Label]]',
      'Heading [[Three#Section]]',
      'Mixed [[Four#H|Alias]]',
      'Empty [[]] [[  ]]'
    ].join('\n')
    expect(parse_wiki_links(md)).toEqual(['One', 'Two', 'Three', 'Four'])
  })

  test('resolve_wiki_link matches by path, stem, and title', () => {
    const notes: NoteMeta[] = [
      { id: 'a/one.md' as any, path: 'a/one.md' as any, title: 'One', mtime_ms: 0, size_bytes: 1 },
      { id: 'two.md' as any, path: 'two.md' as any, title: 'Second Note', mtime_ms: 0, size_bytes: 1 }
    ]

    expect(resolve_wiki_link(notes, 'a/one')).toMatchObject({ path: 'a/one.md' })
    expect(resolve_wiki_link(notes, 'one')).toMatchObject({ path: 'a/one.md' })
    expect(resolve_wiki_link(notes, 'Second Note')).toMatchObject({ path: 'two.md' })
    expect(resolve_wiki_link(notes, 'missing')).toBeNull()
  })

  test('suggest_note_path_for_token sanitizes and appends extension', () => {
    expect(suggest_note_path_for_token('New Note')).toBe('New Note.md')
    expect(suggest_note_path_for_token('a/b')).toBe('a/b.md')
    expect(suggest_note_path_for_token('../x')).toBe('x.md')
    expect(suggest_note_path_for_token('bad:name')).toBe('bad-name.md')
  })
})

