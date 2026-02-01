import { describe, it, expect } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { open_note_flow_machine } from '$lib/flows/open_note_flow'
import { create_mock_notes_port } from '../../unit/helpers/mock_ports'
import { as_note_path, as_markdown_text, as_vault_id } from '$lib/types/ids'
import type { NoteDoc } from '$lib/types/note'

describe('open_note_flow', () => {
  it('opens note and dispatches SET_OPEN_NOTE and SET_SELECTED_FOLDER_PATH', async () => {
    const notes_port = create_mock_notes_port()
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

    const dispatched: unknown[] = []
    const dispatch = (event: unknown) => dispatched.push(event)

    const actor = createActor(open_note_flow_machine, {
      input: { ports: { notes: notes_port }, dispatch }
    })
    actor.start()

    actor.send({ type: 'OPEN_NOTE', vault_id, note_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')

    expect(dispatched).toContainEqual({ type: 'SET_SELECTED_FOLDER_PATH', path: 'docs' })
    expect(dispatched).toContainEqual({
      type: 'SET_OPEN_NOTE',
      open_note: {
        meta: doc.meta,
        markdown: doc.markdown,
        buffer_id: doc.meta.id,
        is_dirty: false
      }
    })
  })

  it('transitions to error state on open failure and can retry', async () => {
    const notes_port = create_mock_notes_port()
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
      input: { ports: { notes: notes_port }, dispatch: () => {} }
    })
    actor.start()

    actor.send({ type: 'OPEN_NOTE', vault_id, note_path })
    await waitFor(actor, (snapshot) => snapshot.value === 'error')
    expect(actor.getSnapshot().context.error).toContain('Read failed')

    actor.send({ type: 'RETRY' })
    await waitFor(actor, (snapshot) => snapshot.value === 'idle')
    expect(attempts).toBe(2)
  })
})
