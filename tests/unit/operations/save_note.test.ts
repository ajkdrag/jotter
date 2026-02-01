import { describe, it, expect } from 'vitest'
import { save_note } from '$lib/operations/save_note'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id, as_markdown_text } from '$lib/types/ids'

describe('save_note', () => {
  it('writes note via port', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')
    const note_id = as_note_path('note.md')
    const markdown = as_markdown_text('hello')

    await save_note({ notes: notes_port }, { vault_id, note_id, markdown })

    expect(notes_port._calls.write_note).toEqual([
      { vault_id, note_id, markdown }
    ])
  })
})
