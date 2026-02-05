import { describe, it, expect } from 'vitest'
import { jotter_asset_url } from '$lib/utils/asset_url'
import { as_asset_path, as_vault_id } from '$lib/types/ids'

describe('jotter_asset_url', () => {
  it('encodes asset paths for custom scheme', () => {
    const vault_id = as_vault_id('vault-1')
    const asset_path = as_asset_path('.assets/folder name/image 1.png')

    const result = jotter_asset_url(vault_id, asset_path)

    expect(result).toBe('jotter-asset://vault/vault-1/.assets/folder%20name/image%201.png')
  })
})
