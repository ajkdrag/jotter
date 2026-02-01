import { describe, it, expect } from 'vitest'
import { change_vault } from '$lib/operations/change_vault'
import { create_mock_vault_port, create_mock_notes_port } from '../helpers/mock_ports'
import { as_vault_path } from '$lib/types/ids'

describe('change_vault errors', () => {
  it('throws when vault path is not found', async () => {
    const vault_port = create_mock_vault_port()
    const notes_port = create_mock_notes_port()

    await expect(
      change_vault({ vault: vault_port, notes: notes_port }, { vault_path: as_vault_path('/missing') })
    ).rejects.toThrow('Vault not found')
  })
})
