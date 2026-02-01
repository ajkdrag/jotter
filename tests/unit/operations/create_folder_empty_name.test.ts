import { describe, it, expect } from 'vitest'
import { create_folder } from '$lib/operations/create_folder'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_id } from '$lib/types/ids'

describe('create_folder edge cases', () => {
  it('returns empty path when folder name is whitespace', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const result = await create_folder(
      { notes: ports.notes },
      { vault_id, parent_path: '', folder_name: '   ' }
    )

    expect(result.new_folder_path).toBe('')
  })
})
