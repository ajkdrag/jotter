import { describe, it, expect } from 'vitest'
import { delete_note } from '$lib/operations/delete_note'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id } from '$lib/types/ids'

describe('delete_note', () => {
  it('deletes note via port', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')
    const note_id = as_note_path('note.md')

    await delete_note({ notes: notes_port }, { vault_id, note_id })

    expect(notes_port._calls.delete_note).toEqual([
      { vault_id, note_id }
    ])
  })
})
