import type { VaultId } from "$lib/shared/types/ids";
import type { VaultFsEvent } from "$lib/features/watcher/types/watcher";

export interface WatcherPort {
  watch_vault(vault_id: VaultId): Promise<void>;
  unwatch_vault(): Promise<void>;
  subscribe_fs_events(callback: (event: VaultFsEvent) => void): () => void;
}
