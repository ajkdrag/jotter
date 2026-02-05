import type { AssetsPort } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'

const blob_url_cache = new Map<string, string>()

export function create_test_assets_adapter(): AssetsPort {
  return {
    resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
      const cache_key = `${vault_id}:${asset_path}`

      const cached_url = blob_url_cache.get(cache_key)
      if (cached_url) {
        return Promise.resolve(cached_url)
      }

      return Promise.reject(new Error(`Asset not found: ${asset_path}`))
    }
  }
}
