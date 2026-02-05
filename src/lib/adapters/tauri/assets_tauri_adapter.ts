import type { AssetsPort } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
import { jotter_asset_url } from '$lib/utils/asset_url'

export function create_assets_tauri_adapter(): AssetsPort {
  return {
    resolve_asset_url(vault_id: VaultId, asset_path: AssetPath) {
      return Promise.resolve(jotter_asset_url(vault_id, asset_path))
    }
  }
}
