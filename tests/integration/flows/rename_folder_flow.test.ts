import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { rename_folder_flow_machine } from '$lib/flows/rename_folder_flow'
import { app_state_machine } from '$lib/state/app_state_machine'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_test_vault } from '../../unit/helpers/test_fixtures'

describe('rename_folder_flow', () => {
  it('renames folder and dispatches RENAME_FOLDER_IN_STATE', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const dispatched: unknown[] = []
    const dispatch = (event: unknown) => dispatched.push(event)

    const actor = createActor(rename_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch }
    })
    actor.start()

    actor.send({ type: 'REQUEST_RENAME', vault_id: vault.id, folder_path: 'old' })
    actor.send({ type: 'UPDATE_NEW_PATH', path: 'new' })
    actor.send({ type: 'CONFIRM' })

    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.rename_folder).toEqual([
      { vault_id: vault.id, from_path: 'old', to_path: 'new' }
    ])
    expect(dispatched).toContainEqual({ type: 'RENAME_FOLDER_IN_STATE', old_path: 'old', new_path: 'new' })
    expect(index_port._calls.build_index).toContain(vault.id)
  })

  it('transitions to error and retries', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    let calls = 0
    notes_port.rename_folder = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) throw new Error('Rename failed')
      return Promise.resolve()
    })

    const actor = createActor(rename_folder_flow_machine, {
      input: { ports: { notes: notes_port, index: index_port }, dispatch: () => {} }
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
