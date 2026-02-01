import { describe, expect, test, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { save_note_flow_machine } from '$lib/flows/save_note_flow'
import { app_state_machine, type AppStateContext } from '$lib/state/app_state_machine'
import { create_mock_notes_port } from '../../unit/helpers/mock_ports'
import { create_open_note_state, create_test_note, create_test_vault, create_untitled_note_state } from '../../unit/helpers/test_fixtures'
import type { FlowSnapshot } from '$lib/flows/flow_handle'

function wrap_snapshot(
  snapshot: ReturnType<ReturnType<typeof createActor<typeof app_state_machine>>['getSnapshot']>
): FlowSnapshot<AppStateContext> {
  return {
    context: snapshot.context,
    matches: (state: string) => snapshot.matches(state as never)
  }
}

describe('save_note_flow', () => {
  test('starts in idle state', () => {
    const notes_port = create_mock_notes_port()
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    expect(actor.getSnapshot().value).toBe('idle')
  })

  test('no-op when there is no vault', async () => {
    const notes_port = create_mock_notes_port()
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.write_note).toHaveLength(0)
    expect(notes_port._calls.create_note).toHaveLength(0)
  })

  test('creates untitled note when vault is active and has auto-created open note', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.write_note).toHaveLength(0)
  })

  test('writes existing note', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.write_note).toHaveLength(1)
    expect(notes_port._calls.write_note[0]).toEqual({
      vault_id: vault.id,
      note_id: note.id,
      markdown: open_note.markdown
    })
  })

  test('creates new note for Untitled and updates note id', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('Untitled-1')
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.create_note[0]).toEqual({
      vault_id: vault.id,
      note_path: 'Untitled-1.md',
      markdown: open_note.markdown
    })

    const final_state = app_state.getSnapshot().context.open_note
    expect(final_state?.meta.id).toBe('Untitled-1.md')
    expect(final_state?.meta.title).toBe('Untitled-1')
  })

  test('saves foldered untitled note with folder path preserved', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('foo/Untitled-1')
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.create_note[0]).toEqual({
      vault_id: vault.id,
      note_path: 'foo/Untitled-1.md',
      markdown: open_note.markdown
    })

    const final_state = app_state.getSnapshot().context.open_note
    expect(final_state?.meta.id).toBe('foo/Untitled-1.md')
    expect(final_state?.meta.path).toBe('foo/Untitled-1.md')
  })

  test('invokes on_save_complete callback on success', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const app_state = createActor(app_state_machine, { input: {} })
    app_state.start()

    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const on_save_complete = vi.fn()
    const actor = createActor(save_note_flow_machine, {
      input: {
        ports: { notes: notes_port },
        dispatch: app_state.send,
        get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()),
        on_save_complete
      }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, state => state.matches('idle'))

    expect(on_save_complete).toHaveBeenCalledTimes(1)
  })
})
