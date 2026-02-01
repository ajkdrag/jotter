import { describe, it, expect } from 'vitest'
import { get_folder_stats } from '$lib/operations/get_folder_stats'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_vault_id } from '$lib/types/ids'

describe('get_folder_stats', () => {
  it('returns stats from port', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')

    notes_port.get_folder_stats = async () => ({ note_count: 2, folder_count: 3 })

    const result = await get_folder_stats({ notes: notes_port }, { vault_id, folder_path: 'docs' })

    expect(result).toEqual({ note_count: 2, folder_count: 3 })
  })
})
