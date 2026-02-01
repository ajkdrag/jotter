import { describe, it, expect } from 'vitest'
import { delete_folder } from '$lib/operations/delete_folder'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id } from '$lib/types/ids'

describe('delete_folder', () => {
  it('deletes folder via port and returns payload', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')
    const expected = { deleted_notes: [as_note_path('a.md')], deleted_folders: ['a'] }

    notes_port.delete_folder = async () => expected

    const result = await delete_folder({ notes: notes_port }, { vault_id, folder_path: 'a' })

    expect(result).toEqual(expected)
  })
})
