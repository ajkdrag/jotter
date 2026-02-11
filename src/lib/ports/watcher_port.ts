import type { VaultId } from "$lib/types/ids";
import type { VaultFsEvent } from "$lib/types/watcher";

export interface WatcherPort {
  watch_vault(vault_id: VaultId): Promise<void>;
  unwatch_vault(): Promise<void>;
  subscribe_fs_events(callback: (event: VaultFsEvent) => void): () => void;
}
