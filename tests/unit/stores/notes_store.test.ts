import { describe, expect, it } from 'vitest'
import { NotesStore } from '$lib/stores/notes_store.svelte'
import type { NoteMeta } from '$lib/types/note'
import type { NoteId, NotePath } from '$lib/types/ids'

function note(path: string): NoteMeta {
  return {
    id: path as NoteId,
    path: path as NotePath,
    title: path.split('/').pop()?.replace('.md', '') ?? '',
    mtime_ms: 0,
    size_bytes: 0
  }
}

describe('NotesStore.merge_folder_contents', () => {
  it('adds notes and folders on first load', () => {
    const store = new NotesStore()

    store.merge_folder_contents('', {
      notes: [note('readme.md')],
      subfolders: ['docs', 'tests']
    })

    expect(store.notes.map((n) => n.path)).toEqual(['readme.md'])
    expect(store.folder_paths).toEqual(['docs', 'tests'])
  })

  it('removes stale root-level folders on refresh', () => {
    const store = new NotesStore()

    store.merge_folder_contents('', {
      notes: [],
      subfolders: ['old_folder']
    })
    expect(store.folder_paths).toEqual(['old_folder'])

    store.merge_folder_contents('', {
      notes: [],
      subfolders: ['new_folder']
    })
    expect(store.folder_paths).toEqual(['new_folder'])
  })

  it('removes stale descendants when parent folder disappears', () => {
    const store = new NotesStore()

    store.merge_folder_contents('', {
      notes: [],
      subfolders: ['sss']
    })
    store.merge_folder_contents('sss', {
      notes: [note('sss/note.md')],
      subfolders: ['sss/deep']
    })

    expect(store.folder_paths).toEqual(['sss', 'sss/deep'])
    expect(store.notes.map((n) => n.path)).toEqual(['sss/note.md'])

    store.merge_folder_contents('', {
      notes: [],
      subfolders: ['ddd']
    })

    expect(store.folder_paths).toEqual(['ddd'])
    expect(store.notes).toEqual([])
  })

  it('preserves entries from unrelated folders', () => {
    const store = new NotesStore()

    store.merge_folder_contents('', {
      notes: [note('root.md')],
      subfolders: ['alpha', 'beta']
    })
    store.merge_folder_contents('alpha', {
      notes: [note('alpha/note.md')],
      subfolders: []
    })

    store.merge_folder_contents('', {
      notes: [note('root.md')],
      subfolders: ['alpha', 'gamma']
    })

    expect(store.folder_paths).toEqual(['alpha', 'gamma'])
    expect(store.notes.map((n) => n.path)).toEqual(['alpha/note.md', 'root.md'])
  })

  it('updates existing notes with fresh metadata', () => {
    const store = new NotesStore()

    store.merge_folder_contents('', {
      notes: [{ ...note('readme.md'), mtime_ms: 100 }],
      subfolders: []
    })

    store.merge_folder_contents('', {
      notes: [{ ...note('readme.md'), mtime_ms: 200 }],
      subfolders: []
    })

    expect(store.notes).toHaveLength(1)
    expect(store.notes[0]?.mtime_ms).toBe(200)
  })

  it('removes stale notes that are direct children of loaded folder', () => {
    const store = new NotesStore()

    store.merge_folder_contents('docs', {
      notes: [note('docs/old.md'), note('docs/keep.md')],
      subfolders: []
    })

    store.merge_folder_contents('docs', {
      notes: [note('docs/keep.md')],
      subfolders: []
    })

    expect(store.notes.map((n) => n.path)).toEqual(['docs/keep.md'])
  })

  it('handles nested folder refresh correctly', () => {
    const store = new NotesStore()

    store.merge_folder_contents('', {
      notes: [],
      subfolders: ['a']
    })
    store.merge_folder_contents('a', {
      notes: [],
      subfolders: ['a/b', 'a/c']
    })
    store.merge_folder_contents('a/b', {
      notes: [note('a/b/note.md')],
      subfolders: []
    })

    store.merge_folder_contents('a', {
      notes: [],
      subfolders: ['a/c', 'a/d']
    })

    expect(store.folder_paths).toEqual(['a', 'a/c', 'a/d'])
    expect(store.notes).toEqual([])
  })

  it('includes folder_path itself in folder_paths', () => {
    const store = new NotesStore()

    store.merge_folder_contents('sub', {
      notes: [],
      subfolders: ['sub/child']
    })

    expect(store.folder_paths).toContain('sub')
    expect(store.folder_paths).toContain('sub/child')
  })
})
