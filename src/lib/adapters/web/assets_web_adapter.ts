import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import { as_asset_path, type AssetPath, type VaultId } from '$lib/types/ids'
import { get_vault } from './storage'

const blob_url_cache = new Map<string, string>()

async function get_vault_handle(vault_id: VaultId): Promise<FileSystemDirectoryHandle> {
  const record = await get_vault(vault_id)
  if (!record) {
    throw new Error(`Vault not found: ${vault_id}`)
  }

  if ('requestPermission' in record.handle && typeof record.handle.requestPermission === 'function') {
    try {
      await (record.handle as { requestPermission: (opts: { mode: string }) => Promise<PermissionState> }).requestPermission({ mode: 'readwrite' })
    } catch (e) {
      throw new Error(`Permission denied for vault: ${vault_id}. ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return record.handle
}

async function ensure_assets_directory(root: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return await root.getDirectoryHandle('assets', { create: true })
}

async function resolve_asset_path(
  root: FileSystemDirectoryHandle,
  target_path: AssetPath
): Promise<{ handle: FileSystemFileHandle; parent: FileSystemDirectoryHandle; name: string }> {
  const assets_dir = await ensure_assets_directory(root)
  const parts = target_path.split('/').filter(Boolean)
  let current = assets_dir
  let name = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const is_last = i === parts.length - 1

    if (is_last) {
      name = part
      const handle = await current.getFileHandle(name, { create: false })
      return { handle, parent: current, name }
    } else {
      current = await current.getDirectoryHandle(part, { create: false })
    }
  }

  throw new Error(`Invalid asset path: ${target_path}`)
}

export function create_assets_web_adapter(): AssetsPort {
  return {
    async import_asset(vault_id: VaultId, source: AssetImportSource, target_path: AssetPath): Promise<AssetPath> {
      const root = await get_vault_handle(vault_id)
      const assets_dir = await ensure_assets_directory(root)
      const parts = target_path.split('/').filter(Boolean)
      let current = assets_dir
      let file_name = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) continue
        const is_last = i === parts.length - 1

        if (is_last) {
          file_name = part
          const file_handle = await current.getFileHandle(file_name, { create: true })
          const writable = await file_handle.createWritable()

          if (source.kind === 'path') {
            throw new Error('Path-based asset import not supported in web environment. Use bytes instead.')
          } else {
            const buffer = new Uint8Array(source.bytes).buffer
            await writable.write(buffer)
          }

          await writable.close()

          const cache_key = `${vault_id}:${target_path}`
          if (blob_url_cache.has(cache_key)) {
            URL.revokeObjectURL(blob_url_cache.get(cache_key)!)
            blob_url_cache.delete(cache_key)
          }

          return target_path
        } else if (part) {
          current = await current.getDirectoryHandle(part, { create: true })
        }
      }

      throw new Error(`Invalid asset path: ${target_path}`)
    },

    async resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
      const cache_key = `${vault_id}:${asset_path}`

      if (blob_url_cache.has(cache_key)) {
        return blob_url_cache.get(cache_key)!
      }

      try {
        const root = await get_vault_handle(vault_id)
        const { handle } = await resolve_asset_path(root, asset_path)
        const file_handle = handle as FileSystemFileHandle
        const file = await file_handle.getFile()
        const blob_url = URL.createObjectURL(file)
        blob_url_cache.set(cache_key, blob_url)
        return blob_url
      } catch (e) {
        throw new Error(`Failed to resolve asset URL: ${asset_path}. ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
}
