import { describe, it, expect } from 'vitest'
import {
  app_state_machine,
  reset_app,
  set_active_vault,
  update_open_note_path,
  update_open_note_path_prefix,
  rename_folder_in_state,
  remove_folder_from_state,
  merge_folder_contents
} from '$lib/state/app_state_machine'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import { createActor } from 'xstate'
import type { NoteMeta } from '$lib/types/note'
import { create_test_vault, create_test_note, create_open_note_state } from '../helpers/test_fixtures'

function make_context(notes: NoteMeta[] = [], folder_paths: string[] = []) {
  return {
    vault: null,
    recent_vaults: [],
    notes,
    folder_paths,
    open_note: null,
    theme: 'system' as const,
    sidebar_open: true,
    selected_folder_path: '',
    now_ms: () => 123
  }
}

describe('app_state_machine helpers', () => {
  it('reset_app clears vault state', () => {
    const context = {
      ...make_context(),
      vault: create_test_vault(),
      notes: [create_test_note('note-1', 'Note')]
    }

    const result = reset_app(context)

    expect(result.vault).toBeNull()
    expect(result.notes).toEqual([])
    expect(result.folder_paths).toEqual([])
    expect(result.open_note).toBeNull()
  })

  it('set_active_vault ensures open note', () => {
    const vault = create_test_vault()
    const result = set_active_vault(make_context(), vault, [])

    expect(result.vault).toEqual(vault)
    expect(result.open_note?.meta.title).toBe('Untitled-1')
  })

  it('update_open_note_path updates metadata and title', () => {
    const note = create_test_note('note-1', 'Note')
    const context = {
      ...make_context(),
      open_note: create_open_note_state(note)
    }

    const result = update_open_note_path(context, as_note_path('folder/renamed.md'))

    expect(result.open_note?.meta.path).toBe('folder/renamed.md')
    expect(result.open_note?.meta.title).toBe('renamed')
  })

  it('update_open_note_path_prefix updates when prefix matches', () => {
    const note = create_test_note('foo/note', 'Note')
    const context = {
      ...make_context(),
      open_note: create_open_note_state(note)
    }

    const result = update_open_note_path_prefix(context, 'foo/', 'bar/')

    expect(result.open_note?.meta.path).toBe('bar/note.md')
  })

  it('rename_folder_in_state updates notes, folders, and open note', () => {
    const note = create_test_note('old/note', 'Note')
    const context = {
      ...make_context([note], ['old', 'old/nested']),
      open_note: create_open_note_state(note)
    }

    const result = rename_folder_in_state(context, 'old', 'new')

    expect(result.notes[0]?.path).toBe('new/note.md')
    expect(result.folder_paths).toEqual(['new', 'new/nested'])
    expect(result.open_note?.meta.path).toBe('new/note.md')
  })

  it('remove_folder_from_state drops nested notes and folders', () => {
    const notes = [create_test_note('docs/a', 'A'), create_test_note('other/b', 'B')]
    const context = make_context(notes, ['docs', 'docs/nested', 'other'])

    const result = remove_folder_from_state(context, 'docs')

    expect(result.notes.map((note) => note.path)).toEqual(['other/b.md'])
    expect(result.folder_paths).toEqual(['other'])
  })

  it('merge_folder_contents merges notes and folders', () => {
    const ctx = make_context([create_test_note('z', 'Z')], ['docs'])
    const result = merge_folder_contents(ctx, '', {
      notes: [create_test_note('a', 'A')],
      subfolders: ['images']
    })

    expect(result.notes.map((note) => note.path)).toEqual(['a.md', 'z.md'])
    expect(result.folder_paths).toEqual(['docs', 'images'])
  })
})

describe('app_state_machine transitions', () => {
  it('transitions from no_vault to vault_open on SET_ACTIVE_VAULT', () => {
    const actor = createActor(app_state_machine, { input: {} })
    actor.start()
    const vault = create_test_vault()

    actor.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })

    expect(actor.getSnapshot().matches('vault_open')).toBe(true)
    expect(actor.getSnapshot().context.vault).toEqual(vault)
    actor.stop()
  })

  it('creates new note in selected folder', () => {
    const actor = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    actor.start()
    const vault = create_test_vault()

    actor.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    actor.send({ type: 'SET_SELECTED_FOLDER_PATH', path: 'projects' })
    actor.send({ type: 'CREATE_NEW_NOTE_IN_CURRENT_FOLDER' })

    const { open_note } = actor.getSnapshot().context
    expect(open_note?.meta.path).toBe('projects/Untitled-1')
    expect(open_note?.meta.title).toBe('Untitled-1')
    actor.stop()
  })

  it('creates new note in root when no folder selected', () => {
    const actor = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    actor.start()
    const vault = create_test_vault()

    actor.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    actor.send({ type: 'CREATE_NEW_NOTE_IN_CURRENT_FOLDER' })

    const { open_note } = actor.getSnapshot().context
    expect(open_note?.meta.path).toBe('Untitled-1')
    actor.stop()
  })

  it('updates markdown and dirty state when open note exists', () => {
    const actor = createActor(app_state_machine, { input: {} })
    actor.start()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'Note')

    actor.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    actor.send({ type: 'SET_OPEN_NOTE', open_note: create_open_note_state(note) })

    actor.send({ type: 'NOTIFY_MARKDOWN_CHANGED', markdown: as_markdown_text('updated') })
    actor.send({ type: 'NOTIFY_DIRTY_STATE_CHANGED', is_dirty: true })

    const { open_note } = actor.getSnapshot().context
    expect(open_note?.markdown).toBe('updated')
    expect(open_note?.is_dirty).toBe(true)
    actor.stop()
  })
})
