import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { delete_folder_flow_machine } from '$lib/flows/delete_folder_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { create_test_note, create_test_vault } from '../../unit/helpers/test_fixtures'
import type { VaultId } from '$lib/types/ids'

describe('delete_folder_flow', () => {
  it('fetches stats then deletes folder and updates stores', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const stores = create_mock_stores()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'folders_set', folder_paths: ['docs'] })
    const note_a = create_test_note('docs/note-a', 'Note A')
    const note_b = create_test_note('docs/sub/note-b', 'Note B')
    stores.dispatch({ type: 'notes_set', notes: [note_a, note_b] })
    notes_port.get_folder_stats = vi.fn().mockResolvedValue({ note_count: 2, folder_count: 1 })
    notes_port.delete_folder = vi.fn((vault_id: VaultId, folder_path: string) => {
      notes_port._calls.delete_folder.push({ vault_id, folder_path })
      return Promise.resolve({
        deleted_notes: [note_a.id, note_b.id],
        deleted_folders: ['docs', 'docs/sub']
      })
    })

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many, now_ms: stores.now_ms }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, folder_path: 'docs', contains_open_note: false })
    await waitFor(actor, (snapshot) => snapshot.value === 'confirming')

    expect(actor.getSnapshot().context.affected_note_count).toBe(2)
    expect(actor.getSnapshot().context.affected_folder_count).toBe(1)

    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.delete_folder).toEqual([
      { vault_id: vault.id, folder_path: 'docs' }
    ])
    expect(stores.notes.get_snapshot().folder_paths).not.toContain('docs')
    expect(index_port._calls.remove_note).toContainEqual({
      vault_id: vault.id,
      note_id: note_a.id
    })
    expect(index_port._calls.remove_note).toContainEqual({
      vault_id: vault.id,
      note_id: note_b.id
    })
  })

  it('clears open note when folder contains open note', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'folders_set', folder_paths: ['docs'] })
    notes_port.get_folder_stats = vi.fn().mockResolvedValue({ note_count: 0, folder_count: 0 })

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many, now_ms: stores.now_ms }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, folder_path: 'docs', contains_open_note: true })
    await waitFor(actor, (snapshot) => snapshot.value === 'confirming')
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.editor.get_snapshot().open_note?.meta.title).toBe('Untitled-1')
  })

  it('handles error when stats fetch fails', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    notes_port.get_folder_stats = vi.fn().mockRejectedValue(new Error('Stats failed'))
    const vault = create_test_vault()
    const stores = create_mock_stores()

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many, now_ms: stores.now_ms }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, folder_path: 'docs', contains_open_note: false })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.error).toContain('Stats failed')
  })

  it('retries delete after error', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const stores = create_mock_stores()
    stores.dispatch({ type: 'vault_set', vault })
    let calls = 0
    notes_port.delete_folder = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) throw new Error('Delete failed')
      return Promise.resolve({ deleted_notes: [], deleted_folders: [] })
    })

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores, dispatch_many: stores.dispatch_many, now_ms: stores.now_ms }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, folder_path: 'docs', contains_open_note: false })
    await waitFor(actor, (snapshot) => snapshot.value === 'confirming')
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(calls).toBe(2)
  })
})
