import { describe, expect, it } from 'vitest'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import { EditorStore } from '$lib/stores/editor_store.svelte'
import { create_open_note_state, create_test_note } from '../helpers/test_fixtures'

describe('EditorStore', () => {
  it('updates markdown and dirty state for open note', () => {
    const store = new EditorStore()
    const note = create_test_note('docs/note', 'note')
    const open_note = create_open_note_state(note)

    store.set_open_note(open_note)
    store.set_markdown(note.id, as_markdown_text('# Updated'))
    store.set_dirty(note.id, true)

    expect(store.open_note?.markdown).toBe(as_markdown_text('# Updated'))
    expect(store.open_note?.is_dirty).toBe(true)
  })

  it('updates note path and title', () => {
    const store = new EditorStore()
    const note = create_test_note('docs/old', 'old')

    store.set_open_note(create_open_note_state(note))
    store.update_open_note_path(as_note_path('docs/new-name.md'))

    expect(store.open_note?.meta.path).toBe(as_note_path('docs/new-name.md'))
    expect(store.open_note?.meta.title).toBe('new-name')
  })
})
