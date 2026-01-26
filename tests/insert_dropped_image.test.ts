import { describe, expect, test, vi } from 'vitest'
import { insert_dropped_image } from '$lib/operations/insert_dropped_image'
import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId, NoteId } from '$lib/types/ids'

describe('insert_dropped_image', () => {
  test('computes stable target_path for path source', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(171)

    const calls: { target_path: AssetPath }[] = []
    const ports: { assets: AssetsPort } = {
      assets: {
        import_asset: async (_vault_id: VaultId, _source: AssetImportSource, target_path: AssetPath) => {
          calls.push({ target_path })
          return target_path
        },
        resolve_asset_url: async () => ''
      }
    }

    const res = await insert_dropped_image(ports, {
      vault_id: 'v' as VaultId,
      note_id: 'notes/Hello World.md' as NoteId,
      source: { kind: 'path', path: '/tmp/pic.PNG' }
    })

    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0]?.target_path).toBe('.assets/hello-world-171.png')
    expect(res.asset_path).toBe('.assets/hello-world-171.png')
  })

  test('uses file_name extension for bytes source', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(42)

    const calls: { target_path: AssetPath }[] = []
    const ports: { assets: AssetsPort } = {
      assets: {
        import_asset: async (_vault_id: VaultId, _source: AssetImportSource, target_path: AssetPath) => {
          calls.push({ target_path })
          return target_path
        },
        resolve_asset_url: async () => ''
      }
    }

    const res = await insert_dropped_image(ports, {
      vault_id: 'v' as VaultId,
      note_id: 'x.md' as NoteId,
      source: { kind: 'bytes', bytes: new Uint8Array([1, 2, 3]), file_name: 'a.jpeg' }
    })

    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0]?.target_path).toBe('.assets/x-42.jpeg')
    expect(res.asset_path).toBe('.assets/x-42.jpeg')
  })
})

