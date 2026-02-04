import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'

const STORAGE_KEY_PREFIX = 'imdown_test_assets_'
const blob_url_cache = new Map<string, string>()
const memory_storage = new Map<string, string>()

const storage = typeof localStorage === 'undefined'
  ? {
    getItem: (key: string) => memory_storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory_storage.set(key, value)
    },
    removeItem: (key: string) => {
      memory_storage.delete(key)
    }
  }
  : localStorage

function get_storage_key(vault_id: VaultId, asset_path: AssetPath): string {
  return `${STORAGE_KEY_PREFIX}${vault_id}_${asset_path}`
}

export function create_test_assets_adapter(): AssetsPort {
  return {
    import_asset(vault_id: VaultId, source: AssetImportSource, target_path: AssetPath): Promise<AssetPath> {
      if (source.kind === 'path') {
        return Promise.reject(new Error('Path-based asset import not supported in test adapter. Use bytes instead.'))
      }

      const key = get_storage_key(vault_id, target_path)
      const buffer = source.bytes.buffer instanceof ArrayBuffer 
        ? source.bytes.buffer 
        : new Uint8Array(source.bytes).buffer
      const blob = new Blob([buffer])
      const blob_url = URL.createObjectURL(blob)
      
      const cache_key = `${vault_id}:${target_path}`
      const existing_url = blob_url_cache.get(cache_key)
      if (existing_url) {
        URL.revokeObjectURL(existing_url)
      }
      blob_url_cache.set(cache_key, blob_url)

      storage.setItem(key, JSON.stringify({
        bytes: Array.from(source.bytes),
        file_name: source.file_name
      }))

      return Promise.resolve(target_path)
    },

    resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
      const cache_key = `${vault_id}:${asset_path}`

      const cached_url = blob_url_cache.get(cache_key)
      if (cached_url) {
        return Promise.resolve(cached_url)
      }

      const key = get_storage_key(vault_id, asset_path)
      const stored = storage.getItem(key)
      
      if (!stored) {
        return Promise.reject(new Error(`Asset not found: ${asset_path}`))
      }

      const data = JSON.parse(stored) as { bytes: number[]; file_name: string }
      const blob = new Blob([new Uint8Array(data.bytes)])
      const blob_url = URL.createObjectURL(blob)
      blob_url_cache.set(cache_key, blob_url)

      return Promise.resolve(blob_url)
    }
  }
}
