import type { AssetsPort } from '$lib/ports/assets_port'
import type { AssetPath, VaultId } from '$lib/types/ids'
import { as_asset_path } from '$lib/types/ids'
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
	target_path: AssetPath
): Promise<{ dir: FileSystemDirectoryHandle; file_name: string }> {
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
		current = await current.getDirectoryHandle(part, { create: false })
	}

	return { dir: current, file_name }
}

function image_extension(input: { mime_type: string; file_name: string | null }): string {
	const from_name = input.file_name?.split('/').pop()?.split('.').pop()?.toLowerCase()
	if (from_name && from_name.length > 0) return from_name

	const from_mime = input.mime_type.toLowerCase()
	if (from_mime === 'image/jpeg') return 'jpg'
	if (from_mime === 'image/png') return 'png'
	if (from_mime === 'image/gif') return 'gif'
	if (from_mime === 'image/webp') return 'webp'
	if (from_mime === 'image/bmp') return 'bmp'
	if (from_mime === 'image/svg+xml') return 'svg'
	return 'png'
}

function safe_stem(input: string): string {
	const normalized = input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')

	return normalized.length > 0 ? normalized : 'image'
}

function create_asset_path(
	note_path: string,
	input: { mime_type: string; file_name: string | null },
	options?: { custom_filename?: string; attachment_folder?: string }
): AssetPath {
	const note_parts = note_path.split('/').filter(Boolean)
	const attachment_folder = options?.attachment_folder || '.assets'

	let filename: string
	if (options?.custom_filename) {
		filename = options.custom_filename
	} else {
		const note_file = note_parts.pop() ?? 'note.md'
		const note_stem = safe_stem(note_file.replace(/\.md$/i, ''))
		const source_name = input.file_name?.split('/').pop() ?? ''
		const source_stem = source_name.length > 0 ? safe_stem(source_name.replace(/\.[^.]+$/i, '')) : note_stem
		const ext = image_extension(input)
		filename = `${source_stem}-${String(Date.now())}.${ext}`
	}

	const directory = note_parts.length > 0 ? `${note_parts.join('/')}/${attachment_folder}` : attachment_folder
	return as_asset_path(`${directory}/${filename}`)
}

async function ensure_path_from_root(
	root: FileSystemDirectoryHandle,
	target_path: AssetPath
): Promise<{ dir: FileSystemDirectoryHandle; file_name: string }> {
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
		current = await current.getDirectoryHandle(part, { create: true })
	}

	return { dir: current, file_name }
}

export function create_assets_web_adapter(): AssetsPort {
	return {
		async resolve_asset_url(vault_id: VaultId, asset_path: AssetPath): Promise<string> {
			const cache_key = `${vault_id}:${asset_path}`

			const cached_url = blob_url_cache.get(cache_key)
			if (cached_url) {
				return cached_url
			}

			try {
				const root = await get_vault_handle(vault_id)
				const { dir, file_name } = await resolve_path_from_root(root, asset_path)
				const file_handle = await dir.getFileHandle(file_name, { create: false })
				const file = await file_handle.getFile()
				const blob_url = URL.createObjectURL(file)
				blob_url_cache.set(cache_key, blob_url)
				return blob_url
			} catch (e) {
				throw new Error(`Failed to resolve asset URL: ${asset_path}. ${e instanceof Error ? e.message : String(e)}`)
			}
		},
		async write_image_asset(vault_id, input) {
			try {
				const root = await get_vault_handle(vault_id)
				const options: Parameters<typeof create_asset_path>[2] = {}
				if (input.custom_filename) {
					options.custom_filename = input.custom_filename
				}
				if (input.attachment_folder) {
					options.attachment_folder = input.attachment_folder
				}
				const asset_path = create_asset_path(String(input.note_path), input.image, options)
				const { dir, file_name } = await ensure_path_from_root(root, asset_path)
				const file_handle = await dir.getFileHandle(file_name, { create: true })
				const writable = await file_handle.createWritable()
				const content = new Uint8Array(input.image.bytes.byteLength)
				content.set(input.image.bytes)
				await writable.write(content)
				await writable.close()
				blob_url_cache.delete(`${vault_id}:${asset_path}`)
				return asset_path
			} catch (e) {
				throw new Error(`Failed to write image asset. ${e instanceof Error ? e.message : String(e)}`)
			}
		}
	}
}
