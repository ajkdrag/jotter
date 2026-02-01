import { describe, it, expect } from 'vitest'
import { rename_folder } from '$lib/operations/rename_folder'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_vault_id } from '$lib/types/ids'

describe('rename_folder', () => {
  it('renames folder via port', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')

    await rename_folder({ notes: notes_port }, { vault_id, from_path: 'old', to_path: 'new' })

    expect(notes_port._calls.rename_folder).toEqual([
      { vault_id, from_path: 'old', to_path: 'new' }
    ])
  })
})
