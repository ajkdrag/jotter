import type { VaultId } from '$lib/types/ids'
import type { VaultFsEvent } from '$lib/types/events'

export interface WatcherPort {
  watch_vault(
    vault_id: VaultId,
    on_event: (event: VaultFsEvent) => void
  ): Promise<() => void | Promise<void>>
}
