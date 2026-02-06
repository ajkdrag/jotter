import { describe, it, expect } from 'vitest'
import { create_editor_store } from '$lib/stores/editor_store'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'

function create_open_note(id = 'note.md'): OpenNoteState {
  const path = as_note_path(id)
  return {
    meta: { id: path, path, title: 'note', mtime_ms: 0, size_bytes: 0 },
    markdown: as_markdown_text('hello'),
    buffer_id: path,
    is_dirty: false
  }
}

describe('editor_store cursor', () => {
  it('starts with null cursor', () => {
    const store = create_editor_store()
    expect(store.get_snapshot().cursor).toBeNull()
  })

  it('updates cursor on editor_cursor_changed for matching note', () => {
    const store = create_editor_store()
    const note = create_open_note()
    store.reduce({ type: 'open_note_set', open_note: note })

    store.reduce({
      type: 'editor_cursor_changed',
      note_id: note.meta.id,
      cursor: { line: 3, column: 7, total_lines: 10 }
    })

    expect(store.get_snapshot().cursor).toEqual({ line: 3, column: 7, total_lines: 10 })
  })

  it('ignores editor_cursor_changed for non-matching note', () => {
    const store = create_editor_store()
    const note = create_open_note()
    store.reduce({ type: 'open_note_set', open_note: note })

    store.reduce({
      type: 'editor_cursor_changed',
      note_id: as_note_path('other.md'),
      cursor: { line: 1, column: 1, total_lines: 1 }
    })

    expect(store.get_snapshot().cursor).toBeNull()
  })

  it('clears cursor on open_note_cleared', () => {
    const store = create_editor_store()
    const note = create_open_note()
    store.reduce({ type: 'open_note_set', open_note: note })
    store.reduce({
      type: 'editor_cursor_changed',
      note_id: note.meta.id,
      cursor: { line: 1, column: 1, total_lines: 1 }
    })

    store.reduce({ type: 'open_note_cleared' })

    expect(store.get_snapshot().cursor).toBeNull()
    expect(store.get_snapshot().open_note).toBeNull()
  })

  it('clears cursor on open_note_set (new note)', () => {
    const store = create_editor_store()
    const note1 = create_open_note('note1.md')
    store.reduce({ type: 'open_note_set', open_note: note1 })
    store.reduce({
      type: 'editor_cursor_changed',
      note_id: note1.meta.id,
      cursor: { line: 5, column: 3, total_lines: 20 }
    })

    const note2 = create_open_note('note2.md')
    store.reduce({ type: 'open_note_set', open_note: note2 })

    expect(store.get_snapshot().cursor).toBeNull()
    expect(store.get_snapshot().open_note?.meta.id).toBe(note2.meta.id)
  })

  it('preserves cursor across markdown update', () => {
    const store = create_editor_store()
    const note = create_open_note()
    store.reduce({ type: 'open_note_set', open_note: note })
    store.reduce({
      type: 'editor_cursor_changed',
      note_id: note.meta.id,
      cursor: { line: 2, column: 4, total_lines: 5 }
    })

    store.reduce({
      type: 'editor_markdown_changed',
      note_id: note.meta.id,
      markdown: as_markdown_text('updated')
    })

    expect(store.get_snapshot().cursor).toEqual({ line: 2, column: 4, total_lines: 5 })
    expect(store.get_snapshot().open_note?.markdown).toBe('updated')
  })
})
