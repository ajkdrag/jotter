import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { save_note_flow_machine } from '$lib/flows/save_note_flow'
import { app_state_machine } from '$lib/state/app_state_machine'
import { create_mock_notes_port } from '../../unit/helpers/mock_ports'
import { create_open_note_state, create_test_note, create_test_vault } from '../../unit/helpers/test_fixtures'

describe('save_note_flow errors', () => {
  it('transitions to error and can cancel', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.write_note = async () => {
      throw new Error('Save failed')
    }
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: {
        ports: { notes: notes_port },
        dispatch: app_state.send,
        get_app_state_snapshot: () => {
          const snapshot = app_state.getSnapshot()
          return {
            context: snapshot.context,
            matches: (state: string) => snapshot.matches(state as 'no_vault' | 'vault_open')
          }
        }
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
