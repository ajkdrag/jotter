import { describe, it, expect } from 'vitest'
import { open_last_vault } from '$lib/operations/open_last_vault'
import { create_mock_notes_port, create_mock_vault_port } from '../helpers/mock_ports'

describe('open_last_vault errors', () => {
  it('throws when last vault id cannot be opened', async () => {
    const vault_port = create_mock_vault_port()
    const notes_port = create_mock_notes_port()

    vault_port.get_last_vault_id = () => Promise.resolve('missing' as never)

    await expect(open_last_vault({ vault: vault_port, notes: notes_port })).rejects.toThrow('Vault not found')
  })
})
