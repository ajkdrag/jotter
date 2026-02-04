import { describe, it, expect } from 'vitest'
import { open_last_vault } from '$lib/operations/open_last_vault'
import { create_mock_notes_port, create_mock_vault_port } from '../helpers/mock_ports'
import { create_test_vault, create_test_note } from '../helpers/test_fixtures'

describe('open_last_vault', () => {
  it('returns null when no last vault id', async () => {
    const vault_port = create_mock_vault_port()
    const notes_port = create_mock_notes_port()

    const result = await open_last_vault({ vault: vault_port, notes: notes_port })

    expect(result).toBeNull()
  })

  it('opens last vault and loads notes', async () => {
    const vault_port = create_mock_vault_port()
    const notes_port = create_mock_notes_port()
    const vault = create_test_vault()
    const note = create_test_note('note-1', 'Note')

    vault_port._mock_vaults = [vault]
    vault_port.get_last_vault_id = () => Promise.resolve(vault.id)
    notes_port._mock_notes.set(vault.id, [note])

    const result = await open_last_vault({ vault: vault_port, notes: notes_port })

    expect(result?.vault).toEqual(vault)
    expect(result?.notes).toEqual([note])
  })
})
