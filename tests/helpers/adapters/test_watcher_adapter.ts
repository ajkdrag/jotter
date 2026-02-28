import type { WatcherPort } from "$lib/features/watcher";
import type { VaultId } from "$lib/shared/types/ids";
import type { VaultFsEvent } from "$lib/features/watcher";

export function create_test_watcher_adapter(): WatcherPort {
  return {
    async watch_vault(_vault_id: VaultId): Promise<void> {},
    async unwatch_vault(): Promise<void> {},
    subscribe_fs_events(_callback: (event: VaultFsEvent) => void): () => void {
      return () => {};
    },
  };
}
