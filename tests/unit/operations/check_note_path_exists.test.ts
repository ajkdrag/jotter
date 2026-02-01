import { describe, it, expect } from 'vitest'
import { check_note_path_exists } from '$lib/operations/check_note_path_exists'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_id, as_note_path } from '$lib/types/ids'

describe('check_note_path_exists', () => {
  it('returns true when note path exists', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const exists = await check_note_path_exists(
      { notes: ports.notes },
      { vault_id, note_path: as_note_path('welcome.md') }
    )

    expect(exists).toBe(true)
  })

  it('returns false when note path does not exist', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const exists = await check_note_path_exists(
      { notes: ports.notes },
      { vault_id, note_path: as_note_path('nonexistent.md') }
    )

    expect(exists).toBe(false)
  })
})
