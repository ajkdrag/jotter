import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { rename_note_flow_machine } from '$lib/flows/rename_note_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import type { VaultId, VaultPath, NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

function create_test_vault(): Vault {
  return {
    id: 'vault-1' as VaultId,
    name: 'Test Vault',
    path: '/test/vault' as VaultPath,
    created_at: 0
  }
}

function create_test_note(id: string, title: string): NoteMeta {
  return {
    id: `${id}.md` as NoteId,
    path: `${id}.md` as NotePath,
    title,
    mtime_ms: 0,
    size_bytes: 0
  }
}

function create_open_note_state(note: NoteMeta): OpenNoteState {
  return {
    meta: note,
    markdown: as_markdown_text('content'),
    buffer_id: note.id,
    is_dirty: false
  }
}

describe('rename_note_flow', () => {
  test('starts in idle state', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const stores = create_mock_stores()

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_rename).toBe(null)
  })

  test('transitions to confirming on REQUEST_RENAME', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const stores = create_mock_stores()
    const vault = create_test_vault()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })

    expect(actor.getSnapshot().value).toBe('confirming')
    expect(actor.getSnapshot().context.note_to_rename).toEqual(note)
    expect(actor.getSnapshot().context.new_path).toEqual(note.path)
  })

  test('updates new_path on UPDATE_NEW_PATH', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const stores = create_mock_stores()
    const vault = create_test_vault()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    const new_path = as_note_path('folder/new-title.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })

    expect(actor.getSnapshot().context.new_path).toEqual(new_path)
  })

  test('returns to idle on CANCEL', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const stores = create_mock_stores()
    const vault = create_test_vault()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_rename).toBe(null)
  })

  test('renames note successfully without conflict', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    const new_path = as_note_path('renamed.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.rename_note).toHaveLength(1)
    expect(notes_port._calls.rename_note[0]).toEqual({
      vault_id: vault.id,
      from: note.path,
      to: new_path
    })
    expect(stores.notes.get_snapshot().notes[0]?.path).toEqual(new_path)
    expect(index_port._calls.remove_note).toContainEqual({
      vault_id: vault.id,
      note_id: note.id
    })
    expect(index_port._calls.upsert_note).toContainEqual({
      vault_id: vault.id,
      note_id: new_path
    })
  })

  test('detects conflict and transitions to conflict_confirm', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note1 = create_test_note('note-1', 'My Note')
    const note2 = create_test_note('note-2', 'Existing Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note1, note2])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note1, note2] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note: note1, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: note2.path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'conflict_confirm')

    expect(actor.getSnapshot().context.target_exists).toBe(true)
  })

  test('overwrites existing file on CONFIRM_OVERWRITE', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note1 = create_test_note('note-1', 'My Note')
    const note2 = create_test_note('note-2', 'Existing Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note1, note2])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note1, note2] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note: note1, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: note2.path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'conflict_confirm')
    actor.send({ type: 'CONFIRM_OVERWRITE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.rename_note).toHaveLength(1)
    expect(notes_port._calls.rename_note[0]).toEqual({
      vault_id: vault.id,
      from: note1.path,
      to: note2.path
    })
  })

  test('cancels from conflict_confirm and returns to confirming', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note1 = create_test_note('note-1', 'My Note')
    const note2 = create_test_note('note-2', 'Existing Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note1, note2])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note1, note2] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note: note1, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: note2.path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'conflict_confirm')
    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('confirming')
    expect(actor.getSnapshot().context.target_exists).toBe(false)
  })

  test('updates open note path when renamed note is currently open', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })
    stores.dispatch({ type: 'open_note_set', open_note: create_open_note_state(note) })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many }
    })
    actor.start()

    const new_path = as_note_path('renamed.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: true })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.editor.get_snapshot().open_note?.meta.path).toBe(new_path)
  })
})
