import { describe, expect, test } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { save_note_flow_machine } from '$lib/flows/save_note_flow'
import { app_state_machine, type AppStateContext } from '$lib/state/app_state_machine'
import { create_mock_notes_port } from '../helpers/mock_ports'
import type { VaultId, VaultPath, NoteId, NotePath } from '$lib/types/ids'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import type { FlowSnapshot } from '$lib/flows/flow_handle'

function wrap_snapshot(snapshot: ReturnType<ReturnType<typeof createActor<typeof app_state_machine>>['getSnapshot']>): FlowSnapshot<AppStateContext> {
  return {
    context: snapshot.context,
    matches: (state: string) => snapshot.matches(state as never)
  }
}

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

function create_open_note_state(note: NoteMeta, dirty = false): OpenNoteState {
  return {
    meta: note,
    markdown: as_markdown_text('content'),
    dirty,
    revision_id: dirty ? 1 : 0,
    saved_revision_id: 0,
    sticky_dirty: false,
    last_saved_at_ms: 0
  }
}

function create_untitled_note_state(title: string, dirty = true): OpenNoteState {
  return {
    meta: {
      id: as_note_path(title),
      path: as_note_path(title),
      title,
      mtime_ms: 0,
      size_bytes: 0
    },
    markdown: as_markdown_text('untitled content'),
    dirty,
    revision_id: 1,
    saved_revision_id: 0,
    sticky_dirty: false,
    last_saved_at_ms: 0
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
    expect(actor.getSnapshot().context.error).toBe(null)
  })

  test('no-op when there is no vault', async () => {
    const notes_port = create_mock_notes_port()
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.write_note).toHaveLength(0)
    expect(notes_port._calls.create_note).toHaveLength(0)
  })

  test('no-op when there is no open note', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    app_state.send({ type: 'CLEAR_OPEN_NOTE' })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.write_note).toHaveLength(0)
    expect(notes_port._calls.create_note).toHaveLength(0)
  })

  test('no-op when open note is not dirty', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note, false)
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.write_note).toHaveLength(0)
    expect(notes_port._calls.create_note).toHaveLength(0)
  })

  test('writes existing note and marks as saved', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note, true)
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.write_note).toHaveLength(1)
    expect(notes_port._calls.write_note[0]).toEqual({
      vault_id: vault.id,
      note_id: note.id,
      markdown: open_note.markdown
    })
    expect(notes_port._calls.create_note).toHaveLength(0)

    const final_state = app_state.getSnapshot().context.open_note
    expect(final_state?.dirty).toBe(false)
    expect(final_state?.saved_revision_id).toBe(1)
    expect(final_state?.last_saved_at_ms).toBeGreaterThan(0)
  })

  test('creates new note for Untitled and updates note id', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('Untitled-1', true)
    notes_port._mock_notes.set(vault.id, [])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(notes_port._calls.create_note).toHaveLength(1)
    expect(notes_port._calls.create_note[0]).toEqual({
      vault_id: vault.id,
      note_path: as_note_path('Untitled-1.md'),
      markdown: open_note.markdown
    })
    expect(notes_port._calls.write_note).toHaveLength(0)

    const final_state = app_state.getSnapshot().context.open_note
    expect(final_state?.meta.id).toBe('Untitled-1.md')
    expect(final_state?.meta.title).toBe('Untitled-1')
    expect(final_state?.dirty).toBe(false)
    expect(final_state?.saved_revision_id).toBe(0)

    app_state.send({
      type: 'NOTIFY_REVISION_CHANGED',
      note_id: as_note_path('Untitled-1.md'),
      revision_id: 0,
      sticky_dirty: false
    })
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(false)
  })

  test('refreshes notes list after save', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note, true)
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(app_state.getSnapshot().context.notes).toEqual([note])
  })

  test('transitions to error state on save failure', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.write_note = async () => {
      throw new Error('Disk full')
    }
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note, true)
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    expect(actor.getSnapshot().context.error).toContain('Disk full')
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(true)
  })

  test('retries save from error state', async () => {
    const notes_port = create_mock_notes_port()
    let attempt = 0
    const original_write = notes_port.write_note.bind(notes_port)
    notes_port.write_note = async (vault_id, note_id, markdown) => {
      attempt++
      if (attempt === 1) throw new Error('Network error')
      await original_write(vault_id, note_id, markdown)
    }
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note, true)
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(attempt).toBe(2)
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(false)
  })

  test('cancels from error state and clears error', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.write_note = async () => {
      throw new Error('Permission denied')
    }
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'My Note')
    const open_note = create_open_note_state(note, true)
    notes_port._mock_notes.set(vault.id, [note])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [note] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.error).toBe(null)
    expect(app_state.getSnapshot().context.open_note?.dirty).toBe(true)
  })

  test('creates untitled note and adds it to notes list', async () => {
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const open_note = create_untitled_note_state('Untitled-2', true)
    notes_port._mock_notes.set(vault.id, [])
    const app_state = createActor(app_state_machine, { input: { now_ms: () => 123 } })
    app_state.start()
    app_state.send({ type: 'SET_ACTIVE_VAULT', vault, notes: [] })
    app_state.send({ type: 'SET_OPEN_NOTE', open_note })

    const actor = createActor(save_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch: app_state.send, get_app_state_snapshot: () => wrap_snapshot(app_state.getSnapshot()) }
    })
    actor.start()

    actor.send({ type: 'REQUEST_SAVE' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    const notes = app_state.getSnapshot().context.notes
    expect(notes).toHaveLength(1)
    expect(notes[0]?.id).toBe('Untitled-2.md')
    expect(notes[0]?.title).toBe('Untitled-2')
  })
})
