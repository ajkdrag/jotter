import { describe, it, expect } from 'vitest'
import { create_folder } from '$lib/operations/create_folder'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_id } from '$lib/types/ids'

describe('create_folder', () => {
  it('creates folder and returns new folder path', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const result = await create_folder(
      { notes: ports.notes },
      { vault_id, parent_path: '', folder_name: 'new-folder' }
    )

    expect(result.new_folder_path).toBe('new-folder')
  })

  it('trims folder name and constructs correct path', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const result = await create_folder(
      { notes: ports.notes },
      { vault_id, parent_path: '', folder_name: '  spaced  ' }
    )

    expect(result.new_folder_path).toBe('spaced')
  })

  it('constructs nested folder path correctly', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const result = await create_folder(
      { notes: ports.notes },
      { vault_id, parent_path: 'parent/child', folder_name: 'nested' }
    )

    expect(result.new_folder_path).toBe('parent/child/nested')
  })
})
