import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { open_note_flow_machine } from '$lib/flows/open_note_flow'
import { create_mock_notes_port } from '../../unit/helpers/mock_ports'
import { create_mock_stores } from '../../unit/helpers/mock_stores'
import { as_note_path, as_markdown_text, as_vault_id } from '$lib/types/ids'
import type { NoteDoc } from '$lib/types/note'

describe('open_note_flow', () => {
  it('opens note and updates stores', async () => {
    const notes_port = create_mock_notes_port()
    const stores = create_mock_stores()
    const vault_id = as_vault_id('vault-1')
    const note_path = as_note_path('docs/note.md')
    const doc: NoteDoc = {
      meta: {
        id: note_path,
        path: note_path,
        title: 'note',
        mtime_ms: 0,
        size_bytes: 10
      },
      markdown: as_markdown_text('content')
    }

    notes_port.read_note = async () => doc

    const actor = createActor(open_note_flow_machine, {
      input: { ports: { notes: notes_port }, stores }
    })
    actor.start()

    actor.send({ type: 'OPEN_NOTE', vault_id, note_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.ui.get_snapshot().selected_folder_path).toBe('docs')
    expect(stores.editor.get_snapshot().open_note).toEqual({
      meta: doc.meta,
      markdown: doc.markdown,
      buffer_id: doc.meta.id,
      is_dirty: false
    })
  })

  it('transitions to error state on open failure and can retry', async () => {
    const notes_port = create_mock_notes_port()
    const stores = create_mock_stores()
    const vault_id = as_vault_id('vault-1')
    const note_path = as_note_path('note.md')

    let attempts = 0
    notes_port.read_note = async () => {
      attempts++
      if (attempts === 1) throw new Error('Read failed')
      return {
        meta: {
          id: note_path,
          path: note_path,
          title: 'note',
          mtime_ms: 0,
          size_bytes: 10
        },
        markdown: as_markdown_text('content')
      }
    }

    const actor = createActor(open_note_flow_machine, {
      input: { ports: { notes: notes_port }, stores }
    })
    actor.start()

    actor.send({ type: 'OPEN_NOTE', vault_id, note_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')
    expect(actor.getSnapshot().context.error).toContain('Read failed')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')
    expect(attempts).toBe(2)
  })

  it('recovers from error when opening a different note', async () => {
    const notes_port = create_mock_notes_port()
    const stores = create_mock_stores()
    const vault_id = as_vault_id('vault-1')
    const first_path = as_note_path('missing.md')
    const second_path = as_note_path('ok.md')

    notes_port.read_note = async (_vault_id, note_id) => {
      if (note_id === first_path) throw new Error('Read failed')
      return {
        meta: {
          id: second_path,
          path: second_path,
          title: 'ok',
          mtime_ms: 0,
          size_bytes: 10
        },
        markdown: as_markdown_text('content')
      }
    }

    const actor = createActor(open_note_flow_machine, {
      input: { ports: { notes: notes_port }, stores }
    })
    actor.start()

    actor.send({ type: 'OPEN_NOTE', vault_id, note_path: first_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')

    actor.send({ type: 'OPEN_NOTE', vault_id, note_path: second_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.editor.get_snapshot().open_note?.meta.path).toBe(second_path)
  })

  it('creates note when opening a wiki link that is missing', async () => {
    const notes_port = create_mock_notes_port()
    const stores = create_mock_stores()
    const vault_id = as_vault_id('vault-1')
    const note_path = as_note_path('wiki/new_note.md')

    notes_port.read_note = async () => {
      throw new Error('Missing')
    }

    const actor = createActor(open_note_flow_machine, {
      input: { ports: { notes: notes_port }, stores }
    })
    actor.start()

    actor.send({ type: 'OPEN_WIKI_LINK', vault_id, note_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(stores.editor.get_snapshot().open_note?.meta.path).toBe(note_path)
    expect(stores.notes.get_snapshot().notes.some((note) => note.path === note_path)).toBe(true)
  })
})
