import { describe, it, expect } from 'vitest'
import { create_test_workspace_index_adapter } from '$lib/adapters/test/test_workspace_index_adapter'
import { as_vault_id } from '$lib/types/ids'

describe('test_workspace_index_adapter', () => {
  it('build_index resolves', async () => {
    const adapter = create_test_workspace_index_adapter()
    await expect(adapter.build_index(as_vault_id('vault-1'))).resolves.toBeUndefined()
  })
})
