import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { delete_note_flow_machine } from '$lib/flows/delete_note_flow'
import { app_state_machine } from '$lib/flows/app_state_machine'
import { create_mock_notes_port, create_mock_index_port } from '../helpers/mock_ports'
import type { VaultId, VaultPath, NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'

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
    id: id as NoteId,
    path: `${id}.md` as NotePath,
    title,
    mtime_ms: 0,
    size_bytes: 0
  }
}

function create_open_note_state(note: NoteMeta): OpenNoteState {
  return {
    meta: note,
    markdown: 'content' as any,
    dirty: false,
    revision_id: 0,
    saved_revision_id: 0,
    sticky_dirty: false,
    last_saved_at_ms: 0
  }
}

describe('delete_note_flow', () => {
  test('starts in idle state', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const model = createActor(app_state_machine, { input: {} })
    model.start()

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_delete).toBe(null)
  })

  test('transitions to confirming on REQUEST_DELETE', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const model = createActor(app_state_machine, { input: {} })
    model.start()
    const vault = create_test_vault()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })

    expect(actor.getSnapshot().value).toBe('confirming')
    expect(actor.getSnapshot().context.note_to_delete).toEqual(note)
  })

  test('returns to idle on CANCEL', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const model = createActor(app_state_machine, { input: {} })
    model.start()
    const vault = create_test_vault()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_delete).toBe(null)
  })

  test('deletes note and updates model on CONFIRM', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const other_note = create_test_note('note-2', 'Other Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note, other_note])
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note, other_note] })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.delete_note).toHaveLength(1)
    expect(notes_port._calls.delete_note[0]).toEqual({
      vault_id: vault.id,
      note_id: note.id
    })
    expect(model.getSnapshot().context.notes).toEqual([other_note])
    expect(index_port._calls.build_index).toContain(vault.id)
  })

  test('creates untitled note when deleted note was open', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    model.send({ type: 'SET_OPEN_NOTE', open_note: create_open_note_state(note) })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: true })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(model.getSnapshot().context.open_note).not.toBe(null)
    expect(model.getSnapshot().context.open_note?.meta.title).toBe('Untitled-1')
    expect(model.getSnapshot().context.open_note?.dirty).toBe(false)
  })

  test('does not clear open_note when different note deleted', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note_to_delete = create_test_note('note-1', 'My Note')
    const open_note = create_test_note('note-2', 'Other Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note_to_delete, open_note])
    const open_note_state = create_open_note_state(open_note)
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note_to_delete, open_note] })
    model.send({ type: 'SET_OPEN_NOTE', open_note: open_note_state })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note: note_to_delete, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(model.getSnapshot().context.open_note).toBe(open_note_state)
    expect(model.getSnapshot().context.notes).toEqual([open_note])
  })

  test('transitions to error state on delete failure and retains note_to_delete', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.delete_note = async () => {
      throw new Error('Network error')
    }
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.note_to_delete).toEqual(note)
    expect(actor.getSnapshot().context.error).toContain('Network error')
    expect(model.getSnapshot().context.notes).toEqual([note])
  })

  test('retries delete from error state', async () => {
    const notes_port = create_mock_notes_port()
    let attempt = 0
    const original_delete = notes_port.delete_note.bind(notes_port)
    notes_port.delete_note = async (vault_id, note_id) => {
      attempt++
      if (attempt === 1) throw new Error('Network error')
      await original_delete(vault_id, note_id)
    }
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(attempt).toBe(2)
    expect(model.getSnapshot().context.notes).toEqual([])
  })

  test('cancels from error state and clears context', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.delete_note = async () => {
      throw new Error('Network error')
    }
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const model = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    model.start()
    model.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: model.send }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_delete).toBe(null)
    expect(actor.getSnapshot().context.error).toBe(null)
    expect(model.getSnapshot().context.notes).toEqual([note])
  })
})
