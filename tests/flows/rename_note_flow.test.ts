import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { rename_note_flow_machine } from '$lib/flows/rename_note_flow'
import { app_state_machine } from '$lib/state/app_state_machine'
import { create_mock_notes_port, create_mock_index_port } from '../helpers/mock_ports'
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
    dirty: false,
    revision_id: 0,
    saved_revision_id: 0,
    sticky_dirty: false,
    last_saved_at_ms: 0
  }
}

describe('rename_note_flow', () => {
  test('starts in idle state', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
    })
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_rename).toBe(null)
  })

  test('transitions to confirming on REQUEST_RENAME', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()
    const vault = create_test_vault()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()
    const vault = create_test_vault()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()
    const vault = create_test_vault()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    expect(app_state.getSnapshot().context.notes?.[0]?.path).toEqual(new_path)
    expect(index_port._calls.build_index).toContain(vault.id)
  })

  test('detects conflict and transitions to conflict_confirm', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note1 = create_test_note('note-1', 'My Note')
    const note2 = create_test_note('note-2', 'Existing Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note1, note2])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note1, note2] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note1, note2] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note1, note2] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
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
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note: create_open_note_state(note) })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
    })
    actor.start()

    const new_path = as_note_path('renamed.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: true })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().context.open_note?.meta.path).toEqual(new_path)
    expect(app_state.getSnapshot().context.open_note?.meta.id).toEqual(new_path)
    expect(app_state.getSnapshot().context.open_note?.meta.title).toEqual('renamed')
  })

  test('transitions to error state on rename failure and retains context', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.rename_note = async () => {
      throw new Error('Network error')
    }
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
    })
    actor.start()

    const new_path = as_note_path('renamed.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.note_to_rename).toEqual(note)
    expect(actor.getSnapshot().context.new_path).toEqual(new_path)
    expect(actor.getSnapshot().context.error).toContain('Network error')
  })

  test('retries rename from error state', async () => {
    const notes_port = create_mock_notes_port()
    let attempt = 0
    const original_rename = notes_port.rename_note.bind(notes_port)
    notes_port.rename_note = async (vault_id, from, to) => {
      attempt++
      if (attempt === 1) throw new Error('Network error')
      await original_rename(vault_id, from, to)
    }
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
    })
    actor.start()

    const new_path = as_note_path('renamed.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(attempt).toBe(2)
    expect(app_state.getSnapshot().context.notes?.[0]?.path).toEqual(new_path)
  })

  test('cancels from error state and clears context', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.rename_note = async () => {
      throw new Error('Network error')
    }
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(rename_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: app_state.send }
    })
    actor.start()

    const new_path = as_note_path('renamed.md')
    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'UPDATE_NEW_PATH', path: new_path })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_rename).toBe(null)
    expect(actor.getSnapshot().context.new_path).toBe(null)
    expect(actor.getSnapshot().context.error).toBe(null)
  })
})
