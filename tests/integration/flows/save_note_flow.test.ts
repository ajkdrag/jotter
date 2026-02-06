import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { save_note_flow_machine } from '$lib/flows/save_note_flow'
import { create_mock_notes_port, create_mock_index_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { create_open_note_state, create_test_note, create_test_vault, create_untitled_note_state } from '../../unit/helpers/test_fixtures'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import { create_stub_editor_flow_handle } from '../../unit/helpers/mock_editor_flow'

describe('save_note_flow', () => {
  test('starts in idle state', () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const stores = create_mock_stores()
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

    expect(actor.getSnapshot().value).toBe('idle')
  })

  test('no-op when there is no vault', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const stores = create_mock_stores()
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
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.write_note).toHaveLength(0)
    expect(notes_port._calls.create_note).toHaveLength(0)
  })

  test('creates untitled note when vault is active and has auto-created open note', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const stores = create_mock_stores()
    stores.dispatch({ type: 'vault_set', vault })
    const open_note = create_untitled_note_state('Untitled-1')
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
    await waitFor(actor, state => state.matches('showing_save_dialog'))

    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.write_note).toHaveLength(0)
  })

  test('writes existing note', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const stores = create_mock_stores({ now_ms: () => 123 })
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
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('Untitled-1')
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [] })
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
    await waitFor(actor, state => state.matches('showing_save_dialog'))

    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.create_note[0]).toEqual({
      vault_id: vault.id,
      note_path: 'Untitled-1.md',
      markdown: open_note.markdown
    })

    const final_state = stores.editor.get_snapshot().open_note
    expect(final_state?.meta.id).toBe('Untitled-1.md')
    expect(final_state?.meta.title).toBe('Untitled-1')
  })

  test('saves untitled note in selected folder', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('foo/Untitled-1')
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [] })
    stores.dispatch({ type: 'open_note_set', open_note })
    stores.dispatch({ type: 'ui_selected_folder_set', path: 'foo' })
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
    await waitFor(actor, state => state.matches('showing_save_dialog'))

    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.create_note[0]).toEqual({
      vault_id: vault.id,
      note_path: 'foo/Untitled-1.md',
      markdown: open_note.markdown
    })

    const final_state = stores.editor.get_snapshot().open_note
    expect(final_state?.meta.id).toBe('foo/Untitled-1.md')
    expect(final_state?.meta.path).toBe('foo/Untitled-1.md')
  })

  test('sanitizes filename on confirm (adds .md if missing)', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('Untitled-1')
    const stores = create_mock_stores({ now_ms: () => 123 })
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [] })
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
    await waitFor(actor, state => state.matches('showing_save_dialog'))

    actor.send({ type: 'UPDATE_NEW_PATH', path: as_note_path('my-custom-note') })
    actor.send({ type: 'CONFIRM' })
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.create_note[0]?.note_path).toBe('my-custom-note.md')

    const final_state = stores.editor.get_snapshot().open_note
    expect(final_state?.meta.id).toBe('my-custom-note.md')
  })

  test('marks open note clean after save', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const stores = create_mock_stores()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })
    stores.dispatch({ type: 'open_note_set', open_note: { ...open_note, is_dirty: true } })
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
    await waitFor(actor, state => state.matches('idle'))

    expect(stores.editor.get_snapshot().open_note?.is_dirty).toBe(false)
  })

  test('saves flushed markdown when flush returns newer content', async () => {
    const notes_port = create_mock_notes_port()
    const index_port = create_mock_index_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note)
    const stores = create_mock_stores()
    stores.dispatch({ type: 'vault_set', vault })
    stores.dispatch({ type: 'notes_set', notes: [note] })
    stores.dispatch({ type: 'open_note_set', open_note: { ...open_note, markdown: as_markdown_text('stale') } })
    const editor_flow = create_stub_editor_flow_handle({
      flush_result: {
        note_id: note.id,
        markdown: as_markdown_text('fresh-from-flush')
      }
    })

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
    await waitFor(actor, state => state.matches('idle'))

    expect(notes_port._calls.write_note[0]?.markdown).toBe(as_markdown_text('fresh-from-flush'))
  })
})
