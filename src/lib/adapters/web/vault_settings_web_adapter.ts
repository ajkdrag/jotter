import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { VaultId } from '$lib/types/ids'
import { logger } from '$lib/utils/logger'
import { APP_DIR } from '$lib/constants/special_folders'
import { get_vault } from './storage'

const SETTINGS_DIR = APP_DIR
const SETTINGS_FILE = 'settings.json'

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

async function ensure_settings_dir(root: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
	return await root.getDirectoryHandle(SETTINGS_DIR, { create: true })
}

async function read_settings_file(settings_dir: FileSystemDirectoryHandle): Promise<Record<string, unknown>> {
	let text: string
	try {
		const file_handle = await settings_dir.getFileHandle(SETTINGS_FILE, { create: false })
		const file = await file_handle.getFile()
		text = await file.text()
	} catch {
		return {}
	}
	try {
		return JSON.parse(text) as Record<string, unknown>
	} catch (e) {
		logger.from_error('Failed to parse vault settings', e)
		return {}
	}
}

async function write_settings_file(settings_dir: FileSystemDirectoryHandle, data: Record<string, unknown>): Promise<void> {
	const file_handle = await settings_dir.getFileHandle(SETTINGS_FILE, { create: true })
	const writable = await file_handle.createWritable()
	await writable.write(JSON.stringify(data, null, 2))
	await writable.close()
}

export function create_vault_settings_web_adapter(): VaultSettingsPort {
	return {
		async get_vault_setting<T>(vault_id: VaultId, key: string): Promise<T | null> {
			try {
				const root = await get_vault_handle(vault_id)
				const settings_dir = await ensure_settings_dir(root)
				const data = await read_settings_file(settings_dir)
				const value = data[key]
				return value !== undefined ? (value as T) : null
			} catch {
				return null
			}
		},

		async set_vault_setting(vault_id: VaultId, key: string, value: unknown): Promise<void> {
			const root = await get_vault_handle(vault_id)
			const settings_dir = await ensure_settings_dir(root)
			const data = await read_settings_file(settings_dir)
			data[key] = value
			await write_settings_file(settings_dir, data)
		}
	}
}
