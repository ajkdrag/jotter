import { describe, it, expect } from 'vitest'
import { rename_note } from '$lib/operations/rename_note'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id } from '$lib/types/ids'

describe('rename_note', () => {
  it('renames note via port', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')
    const from = as_note_path('note.md')
    const to = as_note_path('renamed.md')

    await rename_note({ notes: notes_port }, { vault_id, from, to })

    expect(notes_port._calls.rename_note).toEqual([
      { vault_id, from, to }
    ])
  })
})
