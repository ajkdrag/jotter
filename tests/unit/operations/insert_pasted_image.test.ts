import { describe, expect, test, vi } from 'vitest'
import { insert_pasted_image } from '$lib/operations/insert_pasted_image'
import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'

describe('insert_pasted_image', () => {
  test('builds target path from attachments folder and custom name', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123)

    const calls: { target_path: AssetPath }[] = []
    const ports: { assets: AssetsPort } = {
      assets: {
        import_asset(_vault_id: VaultId, _source: AssetImportSource, target_path: AssetPath) {
          calls.push({ target_path })
          return Promise.resolve(target_path)
        },
        resolve_asset_url() {
          return Promise.resolve('')
        }
      }
    }

    const result = await insert_pasted_image(ports, {
      vault_id: 'vault-1' as VaultId,
      source: { kind: 'bytes', bytes: new Uint8Array([1, 2, 3]), file_name: 'clipboard.png' },
      attachments_folder: '/assets/images/',
      display_name: 'My Diagram.png',
      mime_type: 'image/png'
    })

    expect(calls[0]?.target_path).toBe('assets/images/my-diagram-123.png')
    expect(result.markdown).toBe('![My Diagram](assets/images/my-diagram-123.png)')
  })

  test('falls back to default name and mime type extension', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(42)

    const calls: { target_path: AssetPath }[] = []
    const ports: { assets: AssetsPort } = {
      assets: {
        import_asset(_vault_id: VaultId, _source: AssetImportSource, target_path: AssetPath) {
          calls.push({ target_path })
          return Promise.resolve(target_path)
        },
        resolve_asset_url() {
          return Promise.resolve('')
        }
      }
    }

    const result = await insert_pasted_image(ports, {
      vault_id: 'vault-1' as VaultId,
      source: { kind: 'bytes', bytes: new Uint8Array([4, 5, 6]), file_name: 'clipboard' },
      attachments_folder: ' ',
      display_name: ' ',
      mime_type: 'image/jpeg'
    })

    expect(calls[0]?.target_path).toBe('.assets/image-42.jpg')
    expect(result.markdown).toBe('![image](.assets/image-42.jpg)')
  })
})
