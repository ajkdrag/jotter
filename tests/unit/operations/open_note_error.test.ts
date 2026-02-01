import { describe, it, expect } from 'vitest'
import { open_note } from '$lib/operations/open_note'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id } from '$lib/types/ids'

describe('open_note errors', () => {
  it('propagates read errors', async () => {
    const notes_port = create_mock_notes_port()
    notes_port.read_note = async () => {
      throw new Error('Read failed')
    }

    await expect(
      open_note({ notes: notes_port }, { vault_id: as_vault_id('vault-1'), note_id: as_note_path('missing.md') })
    ).rejects.toThrow('Read failed')
  })
})
