import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'

const STORAGE_KEY_PREFIX = 'imdown_test_assets_'
const blob_url_cache = new Map<string, string>()

function get_storage_key(vault_id: VaultId, asset_path: AssetPath): string {
  return `${STORAGE_KEY_PREFIX}${vault_id}_${asset_path}`
}

export function create_test_assets_adapter(): AssetsPort {
  return {
    async import_asset(vault_id: VaultId, source: AssetImportSource, target_path: AssetPath): Promise<AssetPath> {
      if (source.kind === 'path') {
        throw new Error('Path-based asset import not supported in test adapter. Use bytes instead.')
      }

      const key = get_storage_key(vault_id, target_path)
      const buffer = source.bytes.buffer instanceof ArrayBuffer 
        ? source.bytes.buffer 
        : new Uint8Array(source.bytes).buffer
      const blob = new Blob([buffer])
      const blob_url = URL.createObjectURL(blob)
      
      const cache_key = `${vault_id}:${target_path}`
      if (blob_url_cache.has(cache_key)) {
        URL.revokeObjectURL(blob_url_cache.get(cache_key)!)
      }
      blob_url_cache.set(cache_key, blob_url)

      localStorage.setItem(key, JSON.stringify({
        bytes: Array.from(source.bytes),
        file_name: source.file_name
      }))

      return target_path
    },

    async resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
      const cache_key = `${vault_id}:${asset_path}`

      if (blob_url_cache.has(cache_key)) {
        return blob_url_cache.get(cache_key)!
      }

      const key = get_storage_key(vault_id, asset_path)
      const stored = localStorage.getItem(key)
      
      if (!stored) {
        throw new Error(`Asset not found: ${asset_path}`)
      }

      const data = JSON.parse(stored) as { bytes: number[]; file_name: string }
      const blob = new Blob([new Uint8Array(data.bytes)])
      const blob_url = URL.createObjectURL(blob)
      blob_url_cache.set(cache_key, blob_url)

      return blob_url
    }
  }
}
