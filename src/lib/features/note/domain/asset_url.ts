import type { AssetPath, VaultId } from "$lib/shared/types/ids";

export function otterly_asset_url(
  vault_id: VaultId,
  asset_path: AssetPath,
): string {
  const encoded = String(asset_path)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `otterly-asset://vault/${vault_id}/${encoded}`;
}
