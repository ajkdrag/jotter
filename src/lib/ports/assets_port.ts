import type { AssetPath, VaultId } from '$lib/types/ids'

export interface AssetsPort {
  resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string>
}
