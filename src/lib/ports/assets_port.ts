import type { AssetPath, NotePath, VaultId } from '$lib/types/ids'
import type { PastedImagePayload } from '$lib/types/editor'

export type WriteImageAssetInput = {
  note_path: NotePath
  image: PastedImagePayload
  custom_filename?: string
  attachment_folder?: string
}

export interface AssetsPort {
  resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string>
  write_image_asset(vault_id: VaultId, input: WriteImageAssetInput): Promise<AssetPath>
}
