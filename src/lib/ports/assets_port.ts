import type { AssetPath, VaultId } from '$lib/types/ids'

export type AssetImportSource =
  | { kind: 'path'; path: string }
  | { kind: 'bytes'; bytes: Uint8Array; file_name: string }

export interface AssetsPort {
  import_asset(vault_id: VaultId, source: AssetImportSource, target_path: AssetPath): Promise<AssetPath>
  resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string>
}
