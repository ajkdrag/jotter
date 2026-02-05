import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
import { as_asset_path } from '$lib/types/ids'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'
import { jotter_asset_url } from '$lib/utils/asset_url'

export function create_assets_tauri_adapter(): AssetsPort {
  return {
    async import_asset(vault_id, source: AssetImportSource, target_path: AssetPath) {
      const payload =
        source.kind === 'path'
          ? { kind: 'path', path: source.path }
          : { kind: 'bytes', bytes: source.bytes, file_name: source.file_name }

      const rel = await tauri_invoke<string>('import_asset', {
        args: { vault_id, target_path, source: payload }
      })
      return as_asset_path(rel)
    },
    resolve_asset_url(vault_id: VaultId, asset_path: AssetPath) {
      return Promise.resolve(jotter_asset_url(vault_id, asset_path))
    }
  }
}
