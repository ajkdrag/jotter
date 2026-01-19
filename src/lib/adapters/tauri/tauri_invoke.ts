import { is_tauri } from '$lib/adapters/detect_platform'

export async function tauri_invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!is_tauri) {
    throw new Error(`tauri_invoke called in non-Tauri environment: ${command}`)
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>(command, args)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`tauri invoke failed: ${command}: ${msg}`)
  }
}

