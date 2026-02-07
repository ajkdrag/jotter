import type { AssetsPort } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
import { as_asset_path } from '$lib/types/ids'

const blob_url_cache = new Map<string, string>()
let write_count = 0

export function create_test_assets_adapter(): AssetsPort {
  return {
    resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
      const cache_key = `${vault_id}:${asset_path}`

      const cached_url = blob_url_cache.get(cache_key)
      if (cached_url) {
        return Promise.resolve(cached_url)
      }

      return Promise.reject(new Error(`Asset not found: ${asset_path}`))
    },
    write_image_asset(vault_id, input) {
      write_count += 1

      const note_path = String(input.note_path)
      const parts = note_path.split('/').filter(Boolean)
      const note_name = (parts.pop() ?? 'note.md').replace(/\.md$/i, '')
      const prefix = parts.length > 0 ? `${parts.join('/')}/` : ''
      const asset_path = as_asset_path(`${prefix}.assets/${note_name}-${String(write_count)}.png`)
      const cache_key = `${vault_id}:${asset_path}`
      blob_url_cache.set(cache_key, `test://assets/${encodeURIComponent(String(asset_path))}`)
      return Promise.resolve(asset_path)
    }
  }
}
