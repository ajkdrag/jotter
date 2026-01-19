import { invoke } from '@tauri-apps/api/core'

export async function tauri_invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`tauri invoke failed: ${command}: ${msg}`)
  }
}

