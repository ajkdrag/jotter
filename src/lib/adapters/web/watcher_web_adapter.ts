import type { WatcherPort } from "$lib/ports/watcher_port";
import type { VaultId } from "$lib/types/ids";
import type { VaultFsEvent } from "$lib/types/watcher";

export function create_watcher_web_adapter(): WatcherPort {
  return {
    async watch_vault(_vault_id: VaultId): Promise<void> {},
    async unwatch_vault(): Promise<void> {},
    subscribe_fs_events(_callback: (event: VaultFsEvent) => void): () => void {
      return () => {};
    },
  };
}
