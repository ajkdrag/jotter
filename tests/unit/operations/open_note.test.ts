import { describe, it, expect } from 'vitest'
import { open_note } from '$lib/operations/open_note'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id, as_markdown_text } from '$lib/types/ids'

describe('open_note', () => {
  it('returns the note document from port', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')
    const note_id = as_note_path('note.md')
    const expected = {
      meta: {
        id: note_id,
        path: note_id,
        title: 'note',
        mtime_ms: 0,
        size_bytes: 5
      },
      markdown: as_markdown_text('hello')
    }

    notes_port.read_note = async () => expected

    const result = await open_note({ notes: notes_port }, { vault_id, note_id })

    expect(result).toEqual(expected)
  })
})
