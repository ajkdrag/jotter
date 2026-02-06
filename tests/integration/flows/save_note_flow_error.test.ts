import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { save_note_flow_machine } from '$lib/flows/save_note_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { create_open_note_state, create_test_note, create_test_vault } from '../../unit/helpers/test_fixtures'
import { create_stub_editor_flow_handle } from '../../unit/helpers/mock_editor_flow'

describe('save_note_flow errors', () => {
  it('transitions to error and can cancel', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    notes_port.write_note = () => Promise.reject(new Error('Save failed'))
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const stores = create_mock_stores()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })
    stores.dispatch({ type: 'open_note_set', open_note })
    const editor_flow = create_stub_editor_flow_handle()

    const actor = createActor(save_note_flow_machine, {
      input: {
        ports: { notes: notes_port, index: index_port },
        stores,
        dispatch_many: stores.dispatch_many,
        editor_flow
      }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')
    expect(actor.getSnapshot().context.error).toContain('Save failed')

    actor.send({ type: 'CANCEL' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')
  })
})
