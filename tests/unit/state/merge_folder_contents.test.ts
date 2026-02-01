import { describe, it, expect } from 'vitest'
import { merge_folder_contents, type AppStateContext } from '$lib/state/app_state_machine'
import { as_note_path } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'

function make_note(path: string): NoteMeta {
  return {
    id: as_note_path(path),
    path: as_note_path(path),
    title: path.replace(/\.md$/, '').split('/').pop() ?? '',
    mtime_ms: Date.now(),
    size_bytes: 100
  }
}

function make_context(notes: NoteMeta[] = [], folder_paths: string[] = []): AppStateContext {
  return {
    vault: null,
    recent_vaults: [],
    notes,
    folder_paths,
    open_note: null,
    theme: 'system',
    sidebar_open: true,
    selected_folder_path: '',
    now_ms: () => Date.now()
  }
}

describe('merge_folder_contents', () => {
  it('merges new notes into empty context', () => {
    const ctx = make_context()
    const result = merge_folder_contents(ctx, '', {
      notes: [make_note('a.md'), make_note('b.md')],
      subfolders: []
    })

    expect(result.notes).toHaveLength(2)
    expect(result.notes.map(n => n.path)).toEqual(['a.md', 'b.md'])
  })

  it('merges new folders into context', () => {
    const ctx = make_context()
    const result = merge_folder_contents(ctx, '', {
      notes: [],
      subfolders: ['docs', 'images']
    })

    expect(result.folder_paths).toEqual(['docs', 'images'])
  })

  it('deduplicates notes by id', () => {
    const existing_note = make_note('a.md')
    const ctx = make_context([existing_note])
    const updated_note = { ...make_note('a.md'), size_bytes: 200 }

    const result = merge_folder_contents(ctx, '', {
      notes: [updated_note],
      subfolders: []
    })

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]?.size_bytes).toBe(200)
  })

  it('deduplicates folders', () => {
    const ctx = make_context([], ['docs'])
    const result = merge_folder_contents(ctx, '', {
      notes: [],
      subfolders: ['docs', 'images']
    })

    expect(result.folder_paths).toEqual(['docs', 'images'])
  })

  it('adds the loaded folder path to folder_paths', () => {
    const ctx = make_context()
    const result = merge_folder_contents(ctx, 'projects', {
      notes: [],
      subfolders: []
    })

    expect(result.folder_paths).toContain('projects')
  })

  it('sorts notes by path', () => {
    const ctx = make_context([make_note('z.md')])
    const result = merge_folder_contents(ctx, '', {
      notes: [make_note('a.md'), make_note('m.md')],
      subfolders: []
    })

    expect(result.notes.map(n => n.path)).toEqual(['a.md', 'm.md', 'z.md'])
  })

  it('sorts folders alphabetically', () => {
    const ctx = make_context([], ['z-folder'])
    const result = merge_folder_contents(ctx, '', {
      notes: [],
      subfolders: ['a-folder', 'm-folder']
    })

    expect(result.folder_paths).toEqual(['a-folder', 'm-folder', 'z-folder'])
  })

  it('handles nested folder loading', () => {
    const ctx = make_context([], ['docs'])
    const result = merge_folder_contents(ctx, 'docs', {
      notes: [make_note('docs/readme.md')],
      subfolders: ['docs/guides']
    })

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]?.path).toBe('docs/readme.md')
    expect(result.folder_paths).toContain('docs')
    expect(result.folder_paths).toContain('docs/guides')
  })
})
