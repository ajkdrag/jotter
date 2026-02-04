import type { AssetsPort, AssetImportSource } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
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

async function resolve_path_from_root(
	root: FileSystemDirectoryHandle,
	target_path: AssetPath,
	options: { create_dirs: boolean; create_file: boolean }
): Promise<{ dir: FileSystemDirectoryHandle; file_name: string; file_handle?: FileSystemFileHandle }> {
	const parts = target_path.split('/').filter(Boolean)
	if (parts.length === 0) {
		throw new Error(`Invalid asset path: ${target_path}`)
	}

	const file_name = parts.at(-1) ?? ''
	if (file_name === '') {
		throw new Error(`Invalid asset path: ${target_path}`)
	}
	const dir_parts = parts.slice(0, -1)

	let current = root
	for (const part of dir_parts) {
		current = await current.getDirectoryHandle(part, { create: options.create_dirs })
	}

	if (options.create_file) {
		const file_handle = await current.getFileHandle(file_name, { create: true })
		return { dir: current, file_name, file_handle }
	}

	return { dir: current, file_name }
}

export function create_assets_web_adapter(): AssetsPort {
	return {
		async import_asset(vault_id: VaultId, source: AssetImportSource, target_path: AssetPath): Promise<AssetPath> {
			const root = await get_vault_handle(vault_id)
			const { file_handle } = await resolve_path_from_root(root, target_path, {
				create_dirs: true,
				create_file: true
			})

			if (!file_handle) {
				throw new Error(`Failed to create file handle for: ${target_path}`)
			}

			const writable = await file_handle.createWritable()

			if (source.kind === 'path') {
				throw new Error('Path-based asset import not supported in web environment. Use bytes instead.')
			}

			const src = source.bytes instanceof Uint8Array ? source.bytes : new Uint8Array(source.bytes)
			const copy = new Uint8Array(src.length)
			copy.set(src)
			await writable.write(copy)
			await writable.close()

			const cache_key = `${vault_id}:${target_path}`
			const existing_url = blob_url_cache.get(cache_key)
			if (existing_url) {
				URL.revokeObjectURL(existing_url)
				blob_url_cache.delete(cache_key)
			}

			return target_path
		},

		async resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
			const cache_key = `${vault_id}:${asset_path}`

			const cached_url = blob_url_cache.get(cache_key)
			if (cached_url) {
				return cached_url
			}

			try {
				const root = await get_vault_handle(vault_id)
				const { dir, file_name } = await resolve_path_from_root(root, asset_path, {
					create_dirs: false,
					create_file: false
				})
				const file_handle = await dir.getFileHandle(file_name, { create: false })
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
