import type { WatcherPort } from "$lib/ports/watcher_port";
import type { VaultId } from "$lib/types/ids";
import type { VaultFsEvent } from "$lib/types/watcher";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";
import { listen } from "@tauri-apps/api/event";

function subscribe_vault_fs_events(
  callback: (event: VaultFsEvent) => void,
): () => void {
  let unlisten_fn: (() => void) | null = null;
  let is_disposed = false;

  void listen<VaultFsEvent>("vault_fs_event", (event) => {
    if (is_disposed) {
      return;
    }
    callback(event.payload);
  }).then((fn_ref) => {
    if (is_disposed) {
      fn_ref();
      return;
    }
    unlisten_fn = fn_ref;
  });

  return () => {
    is_disposed = true;
    unlisten_fn?.();
    unlisten_fn = null;
  };
}

export function create_watcher_tauri_adapter(): WatcherPort {
  return {
    async watch_vault(vault_id: VaultId): Promise<void> {
      await tauri_invoke<undefined>("watch_vault", {
        vaultId: vault_id,
      });
    },
    async unwatch_vault(): Promise<void> {
      await tauri_invoke<undefined>("unwatch_vault");
    },
    subscribe_fs_events(callback: (event: VaultFsEvent) => void): () => void {
      return subscribe_vault_fs_events(callback);
    },
  };
}
