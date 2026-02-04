import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { delete_note_flow_machine } from '$lib/flows/delete_note_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import type { VaultId, VaultPath, NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import { as_markdown_text } from '$lib/types/ids'

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
    markdown: as_markdown_text('content'),
    buffer_id: note.id,
    is_dirty: false
  }
}

describe('delete_note_flow', () => {
  test('starts in idle state', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const stores = create_mock_stores()

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_delete).toBe(null)
  })

  test('transitions to confirming on REQUEST_DELETE', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const stores = create_mock_stores()
    const vault = create_test_vault()
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note])

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
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
    const stores = create_mock_stores()
    const vault = create_test_vault()
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note])

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_delete).toBe(null)
  })

  test('deletes note and updates stores on CONFIRM', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const other_note = create_test_note('note-2', 'Other Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note, other_note])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note, other_note])

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
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
    expect(stores.notes.get_snapshot().notes).toEqual([other_note])
    expect(index_port._calls.remove_note).toContainEqual({
      vault_id: vault.id,
      note_id: note.id
    })
  })

  test('creates untitled note when deleted note was open', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note])
    stores.editor.actions.set_open_note(create_open_note_state(note))

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: true })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.editor.get_snapshot().open_note).not.toBe(null)
    expect(stores.editor.get_snapshot().open_note?.meta.title).toBe('Untitled-1')
  })

  test('does not clear open_note when different note deleted', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const note_to_delete = create_test_note('note-1', 'My Note')
    const open_note = create_test_note('note-2', 'Other Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note_to_delete, open_note])
    const open_note_state = create_open_note_state(open_note)
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note_to_delete, open_note])
    stores.editor.actions.set_open_note(open_note_state)

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note: note_to_delete, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.editor.get_snapshot().open_note).toBe(open_note_state)
    expect(stores.notes.get_snapshot().notes).toEqual([open_note])
  })

  test('transitions to error state on delete failure and retains note_to_delete', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.delete_note = () => Promise.reject(new Error('Network error'))
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note])

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.note_to_delete).toEqual(note)
    expect(actor.getSnapshot().context.error).toContain('Network error')
    expect(stores.notes.get_snapshot().notes).toEqual([note])
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
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note])

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(attempt).toBe(2)
    expect(stores.notes.get_snapshot().notes).toEqual([])
  })

  test('cancels from error state and clears context', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.delete_note = () => Promise.reject(new Error('Network error'))
    const index_port = create_mock_index_port()
    const note = create_test_note('note-1', 'My Note')
    const vault = create_test_vault()
    notes_port._mock_notes.set(vault.id, [note])
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_notes([note])

    const actor = createActor(delete_note_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, note, is_note_currently_open: false })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.note_to_delete).toBe(null)
    expect(actor.getSnapshot().context.error).toBe(null)
    expect(stores.notes.get_snapshot().notes).toEqual([note])
  })
})
