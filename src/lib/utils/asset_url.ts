import type { AssetPath, VaultId } from '$lib/types/ids'

export function jotter_asset_url(vault_id: VaultId, asset_path: AssetPath): string {
  const encoded = String(asset_path)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `jotter-asset://vault/${vault_id}/${encoded}`
}

