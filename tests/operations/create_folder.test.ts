import { describe, it, expect } from 'vitest'
import { create_folder_and_refresh } from '$lib/operations/create_folder'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_id } from '$lib/types/ids'

describe('create_folder_and_refresh', () => {
  it('creates folder and returns updated folder list', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const result = await create_folder_and_refresh(
      { notes: ports.notes },
      { vault_id, parent_path: '', folder_name: 'new-folder' }
    )

    expect(result.folder_paths).toContain('new-folder')
  })

  it('trims folder name before creation', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test-vault')

    const result = await create_folder_and_refresh(
      { notes: ports.notes },
      { vault_id, parent_path: '', folder_name: '  spaced  ' }
    )

    expect(result.folder_paths).toContain('spaced')
  })
})
