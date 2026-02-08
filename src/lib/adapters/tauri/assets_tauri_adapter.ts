import type { AssetsPort } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
import { jotter_asset_url } from '$lib/utils/asset_url'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'
import { as_asset_path } from '$lib/types/ids'

export function create_assets_tauri_adapter(): AssetsPort {
  return {
    resolve_asset_url(vault_id: VaultId, asset_path: AssetPath) {
      return jotter_asset_url(vault_id, asset_path)
    },
    async write_image_asset(vault_id, input) {
      const asset_path = await tauri_invoke<string>('write_image_asset', {
        args: {
          vault_id: vault_id,
          note_path: input.note_path,
          mime_type: input.image.mime_type,
          file_name: input.image.file_name,
          bytes: Array.from(input.image.bytes),
          custom_filename: input.custom_filename,
          attachment_folder: input.attachment_folder
        }
      })

      return as_asset_path(asset_path)
    }
  }
}
