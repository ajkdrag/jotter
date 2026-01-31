import { describe, it, expect } from 'vitest'
import { change_vault } from '$lib/operations/change_vault'
import { create_test_ports } from '$lib/adapters/test/test_ports'
import { as_vault_path, as_vault_id } from '$lib/types/ids'

describe('change_vault', () => {
  it('opens vault by path', async () => {
    const ports = create_test_ports()
    const vault_path = as_vault_path('test-vault')

    const result = await change_vault(
      { vault: ports.vault, notes: ports.notes },
      { vault_path }
    )

    expect(result.vault).toBeDefined()
    expect(result.vault.path).toBe(vault_path)
    expect(result.notes).toBeDefined()
    expect(result.folder_paths).toBeDefined()
  })

  it('opens vault by id', async () => {
    const ports = create_test_ports()
    const vault_id = as_vault_id('test_vault_001')

    const result = await change_vault(
      { vault: ports.vault, notes: ports.notes },
      { vault_id }
    )

    expect(result.vault).toBeDefined()
    expect(result.vault.id).toBe(vault_id)
    expect(result.notes).toBeDefined()
    expect(result.folder_paths).toBeDefined()
  })
})
