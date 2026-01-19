import type { WatcherPort } from '$lib/ports/watcher_port'
import type { VaultFsEvent } from '$lib/types/events'
import type { VaultId } from '$lib/types/ids'

export function create_watcher_web_adapter(): WatcherPort {
  return {
    async watch_vault(_vault_id: VaultId, _on_event: (event: VaultFsEvent) => void): Promise<() => void | Promise<void>> {
      return async () => {
      }
    }
  }
}
