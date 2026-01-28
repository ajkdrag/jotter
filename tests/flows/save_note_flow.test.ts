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

function create_open_note_state(note: NoteMeta): OpenNoteState {
  return {
    meta: note,
    markdown: as_markdown_text('content'),
    buffer_id: note.id,
    is_dirty: false
  }
}

function create_untitled_note_state(title: string): OpenNoteState {
  return {
    meta: {
      id: as_note_path(title),
      path: as_note_path(title),
      title,
      mtime_ms: 0,
      size_bytes: 0
    },
    markdown: as_markdown_text('untitled content'),
    buffer_id: `untitled-test:${title}`,
    is_dirty: false
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
    const open_note: OpenNoteState = {
      meta: {
        id: as_note_path('foo/Untitled-1'),
        path: as_note_path('foo/Untitled-1'),
        title: 'Untitled-1',
        mtime_ms: 0,
        size_bytes: 0
      },
      markdown: as_markdown_text('foldered untitled content'),
      buffer_id: 'untitled-test:foo/Untitled-1',
      is_dirty: false
    }
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
})
