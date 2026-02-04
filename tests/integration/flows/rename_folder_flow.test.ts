import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { rename_folder_flow_machine } from '$lib/flows/rename_folder_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { create_test_note, create_test_vault } from '../../unit/helpers/test_fixtures'
import { as_note_path } from '$lib/types/ids'

describe('rename_folder_flow', () => {
  it('renames folder and updates stores', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const stores = create_mock_stores()
    stores.vault.actions.set_vault(vault)
    stores.notes.actions.set_folder_paths(['old'])
    const note_a = create_test_note('old/note-a', 'Note A')
    stores.notes.actions.set_notes([note_a])

    const actor = createActor(rename_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, folder_path: 'old' })
    actor.send({ type: 'UPDATE_NEW_PATH', path: 'new' })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.rename_folder).toEqual([
      { vault_id: vault.id, from_path: 'old', to_path: 'new' }
    ])
    expect(stores.notes.get_snapshot().folder_paths).toContain('new')
    expect(stores.notes.get_snapshot().folder_paths).not.toContain('old')
    expect(index_port._calls.remove_note).toContainEqual({
      vault_id: vault.id,
      note_id: note_a.id
    })
    expect(index_port._calls.upsert_note).toContainEqual({
      vault_id: vault.id,
      note_id: as_note_path('new/note-a.md')
    })
  })

  it('transitions to error and retries', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const stores = create_mock_stores()
    stores.vault.actions.set_vault(vault)
    let calls = 0
    notes_port.rename_folder = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) throw new Error('Rename failed')
      return Promise.resolve()
    })

    const actor = createActor(rename_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, stores }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, folder_path: 'old' })
    actor.send({ type: 'UPDATE_NEW_PATH', path: 'new' })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'error')
    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(calls).toBe(2)
  })
})
