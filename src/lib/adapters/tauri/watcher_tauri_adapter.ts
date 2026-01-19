import { listen } from '@tauri-apps/api/event'
import type { WatcherPort } from '$lib/ports/watcher_port'
import type { VaultFsEvent } from '$lib/types/events'
import type { VaultId } from '$lib/types/ids'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'

export function create_watcher_tauri_adapter(): WatcherPort {
  return {
    async watch_vault(vault_id: VaultId, on_event) {
      await tauri_invoke<void>('watch_vault', { vault_id })
      const unlisten = await listen<VaultFsEvent>('vault_fs_event', (e) => on_event(e.payload))
      return async () => {
        await unlisten()
        await tauri_invoke<void>('unwatch_vault')
      }
    }
  }
}

