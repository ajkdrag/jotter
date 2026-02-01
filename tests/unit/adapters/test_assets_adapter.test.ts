import { describe, it, expect } from 'vitest'
import { create_test_assets_adapter } from '$lib/adapters/test/test_assets_adapter'
import { as_asset_path, as_vault_id } from '$lib/types/ids'

describe('test_assets_adapter', () => {
  it('stores bytes and resolves asset url', async () => {
    const adapter = create_test_assets_adapter()
    const vault_id = as_vault_id('vault-1')
    const asset_path = as_asset_path('.assets/test.png')

    await adapter.import_asset(vault_id, { kind: 'bytes', bytes: new Uint8Array([1, 2, 3]), file_name: 'test.png' }, asset_path)
    const url = await adapter.resolve_asset_url(vault_id, asset_path)

    expect(url).toContain('blob:')
  })
})
