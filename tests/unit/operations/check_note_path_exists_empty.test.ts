import { describe, it, expect } from 'vitest'
import { check_note_path_exists } from '$lib/operations/check_note_path_exists'
import { create_mock_notes_port } from '../helpers/mock_ports'
import { as_note_path, as_vault_id } from '$lib/types/ids'

describe('check_note_path_exists (empty)', () => {
  it('returns false when notes list is empty', async () => {
    const notes_port = create_mock_notes_port()
    const vault_id = as_vault_id('vault-1')

    const exists = await check_note_path_exists(
      { notes: notes_port },
      { vault_id, note_path: as_note_path('missing.md') }
    )

    expect(exists).toBe(false)
  })
})
