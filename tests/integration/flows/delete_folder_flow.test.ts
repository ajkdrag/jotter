import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { delete_folder_flow_machine } from '$lib/flows/delete_folder_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_test_vault } from '../../unit/helpers/test_fixtures'

describe('delete_folder_flow', () => {
  it('fetches stats then deletes folder and updates state', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    notes_port.get_folder_stats = vi.fn().mockResolvedValue({ note_count: 2, folder_count: 1 })

    const dispatched: unknown[] = []
    const dispatch = (event: unknown) => dispatched.push(event)

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch }
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
    expect(dispatched).toContainEqual({ type: 'REMOVE_FOLDER_FROM_STATE', folder_path: 'docs' })
    expect(index_port._calls.build_index).toContain(vault.id)
  })

  it('clears open note when folder contains open note', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    notes_port.get_folder_stats = vi.fn().mockResolvedValue({ note_count: 0, folder_count: 0 })

    const dispatched: unknown[] = []
    const dispatch = (event: unknown) => dispatched.push(event)

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch }
    })
    actor.start()

    actor.send({ type: 'REQUEST_DELETE', vault_id: vault.id, folder_path: 'docs', contains_open_note: true })
    await waitFor(actor, (snapshot) => snapshot.value === 'confirming')
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(dispatched).toContainEqual({ type: 'CLEAR_OPEN_NOTE' })
    expect(dispatched).toContainEqual({ type: 'COMMAND_ENSURE_OPEN_NOTE' })
  })

  it('handles error when stats fetch fails', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    notes_port.get_folder_stats = vi.fn().mockRejectedValue(new Error('Stats failed'))
    const vault = create_test_vault()

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: () => {} }
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
    let calls = 0
    notes_port.delete_folder = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) throw new Error('Delete failed')
      return Promise.resolve({ deleted_notes: [], deleted_folders: [] })
    })

    const actor = createActor(delete_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: () => {} }
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
