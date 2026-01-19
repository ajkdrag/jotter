import { describe, expect, test, vi } from 'vitest'
import { insert_dropped_image } from '$lib/operations/insert_dropped_image'

describe('insert_dropped_image', () => {
  test('computes stable target_path for path source', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(171)

    const calls: any[] = []
    const ports = {
      assets: {
        import_asset: async (_vault_id: string, _source: any, target_path: string) => {
          calls.push({ target_path })
          return target_path as any
        },
        resolve_asset_url: async () => ''
      }
    }

    const res = await insert_dropped_image(ports as any, {
      vault_id: 'v' as any,
      note_id: 'notes/Hello World.md' as any,
      source: { kind: 'path', path: '/tmp/pic.PNG' }
    })

    expect(calls[0].target_path).toBe('.assets/hello-world-171.png')
    expect(res.asset_path).toBe('.assets/hello-world-171.png')
  })

  test('uses file_name extension for bytes source', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(42)

    const calls: any[] = []
    const ports = {
      assets: {
        import_asset: async (_vault_id: string, _source: any, target_path: string) => {
          calls.push({ target_path })
          return target_path as any
        },
        resolve_asset_url: async () => ''
      }
    }

    const res = await insert_dropped_image(ports as any, {
      vault_id: 'v' as any,
      note_id: 'x.md' as any,
      source: { kind: 'bytes', bytes: new Uint8Array([1, 2, 3]), file_name: 'a.jpeg' }
    })

    expect(calls[0].target_path).toBe('.assets/x-42.jpeg')
    expect(res.asset_path).toBe('.assets/x-42.jpeg')
  })
})

