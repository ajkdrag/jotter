import { describe, it, expect } from 'vitest'
import { flatten_filetree } from '$lib/utils/flatten_filetree'
import { as_note_path } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { FolderLoadState } from '$lib/types/filetree'

function make_note(path: string, title?: string): NoteMeta {
  return {
    id: as_note_path(path),
    path: as_note_path(path),
    title: title ?? path.replace(/\.md$/, '').split('/').pop() ?? '',
    mtime_ms: Date.now(),
    size_bytes: 100
  }
}

describe('flatten_filetree', () => {
  it('returns empty array for empty input', () => {
    const result = flatten_filetree({
      notes: [],
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map()
    })
    expect(result).toEqual([])
  })

  it('returns flat list of root-level files', () => {
    const notes = [make_note('a.md'), make_note('b.md')]
    const result = flatten_filetree({
      notes,
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map()
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('a.md')
    expect(result[0]?.depth).toBe(0)
    expect(result[0]?.is_folder).toBe(false)
    expect(result[1]?.name).toBe('b.md')
  })

  it('shows folders at root level when collapsed', () => {
    const notes = [make_note('folder/note.md')]
    const result = flatten_filetree({
      notes,
      folder_paths: ['folder'],
      expanded_paths: new Set(),
      load_states: new Map()
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('folder')
    expect(result[0]?.is_folder).toBe(true)
    expect(result[0]?.is_expanded).toBe(false)
    expect(result[0]?.depth).toBe(0)
  })

  it('shows nested items when folder is expanded', () => {
    const notes = [make_note('folder/note.md')]
    const result = flatten_filetree({
      notes,
      folder_paths: ['folder'],
      expanded_paths: new Set(['folder']),
      load_states: new Map()
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('folder')
    expect(result[0]?.is_expanded).toBe(true)
    expect(result[1]?.name).toBe('note.md')
    expect(result[1]?.depth).toBe(1)
    expect(result[1]?.parent_path).toBe('folder')
  })

  it('shows loading state for folders', () => {
    const result = flatten_filetree({
      notes: [],
      folder_paths: ['folder'],
      expanded_paths: new Set(['folder']),
      load_states: new Map<string, FolderLoadState>([['folder', 'loading']])
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.is_loading).toBe(true)
    expect(result[0]?.has_error).toBe(false)
  })

  it('shows error state for folders', () => {
    const result = flatten_filetree({
      notes: [],
      folder_paths: ['folder'],
      expanded_paths: new Set(['folder']),
      load_states: new Map<string, FolderLoadState>([['folder', 'error']])
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.is_loading).toBe(false)
    expect(result[0]?.has_error).toBe(true)
  })

  it('handles deeply nested structure', () => {
    const notes = [make_note('a/b/c/d.md')]
    const result = flatten_filetree({
      notes,
      folder_paths: ['a', 'a/b', 'a/b/c'],
      expanded_paths: new Set(['a', 'a/b', 'a/b/c']),
      load_states: new Map()
    })

    expect(result).toHaveLength(4)
    expect(result[0]?.path).toBe('a')
    expect(result[0]?.depth).toBe(0)
    expect(result[1]?.path).toBe('a/b')
    expect(result[1]?.depth).toBe(1)
    expect(result[2]?.path).toBe('a/b/c')
    expect(result[2]?.depth).toBe(2)
    expect(result[3]?.path).toBe('a/b/c/d.md')
    expect(result[3]?.depth).toBe(3)
  })

  it('sorts folders before files', () => {
    const notes = [make_note('z.md'), make_note('folder/a.md')]
    const result = flatten_filetree({
      notes,
      folder_paths: ['folder'],
      expanded_paths: new Set(),
      load_states: new Map()
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('folder')
    expect(result[0]?.is_folder).toBe(true)
    expect(result[1]?.name).toBe('z.md')
    expect(result[1]?.is_folder).toBe(false)
  })
})
