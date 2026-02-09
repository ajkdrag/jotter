import type { VaultPort } from "$lib/ports/vault_port";
import {
  as_vault_id,
  as_vault_path,
  type VaultId,
  type VaultPath,
} from "$lib/types/ids";
import type { Vault } from "$lib/types/vault";
import {
  store_vault,
  get_vault,
  list_vaults as list_stored_vaults,
} from "./storage";

const LAST_VAULT_KEY = "jotter_last_vault_id";

const pending_handles = new Map<
  string,
  { handle: FileSystemDirectoryHandle; timestamp: number }
>();

setInterval(() => {
  const now = Date.now();
  for (const [path, entry] of pending_handles.entries()) {
    if (now - entry.timestamp > 60000) {
      pending_handles.delete(path);
    }
  }
}, 30000);

function generate_vault_id(): VaultId {
  return as_vault_id(
    `web_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}`,
  );
}

function read_vault_metadata(handle: FileSystemDirectoryHandle): {
  name: string;
  path: string;
} {
  const name = handle.name;
  const path = name;
  return { name, path };
}

async function is_same_entry(
  left: FileSystemDirectoryHandle,
  right: FileSystemDirectoryHandle,
): Promise<boolean> {
  if ("isSameEntry" in left && typeof left.isSameEntry === "function") {
    try {
      return await left.isSameEntry(right);
    } catch {
      return false;
    }
  }
  return false;
}

async function find_existing_vault_record(
  handle: FileSystemDirectoryHandle,
  path: string,
): Promise<{ id: VaultId; created_at: number } | null> {
  const records = await list_stored_vaults();
  for (const record of records) {
    const same = await is_same_entry(handle, record.handle);
    if (same) {
      return {
        id: as_vault_id(record.id),
        created_at: record.created_at,
      };
    }
  }

  const by_path = records.find((record) => record.path === path);
  if (!by_path) return null;
  return {
    id: as_vault_id(by_path.id),
    created_at: by_path.created_at,
  };
}

export function create_vault_web_adapter(): VaultPort {
  return {
    async choose_vault(): Promise<VaultPath | null> {
      if (!("showDirectoryPicker" in window)) {
        throw new Error(
          "File System Access API not supported. Please use a modern browser with HTTPS or localhost.",
        );
      }

      try {
        const show_picker =
          window.showDirectoryPicker as () => Promise<FileSystemDirectoryHandle>;
        const handle = await show_picker();
        const path = handle.name;
        pending_handles.set(path, { handle, timestamp: Date.now() });
        return as_vault_path(path);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return null;
        }
        throw e;
      }
    },

    async open_vault(vault_path: VaultPath): Promise<Vault> {
      if (!("showDirectoryPicker" in window)) {
        throw new Error("File System Access API not supported");
      }

      let handle: FileSystemDirectoryHandle | null = null;
      const pending = pending_handles.get(vault_path);
      if (pending) {
        handle = pending.handle;
        pending_handles.delete(vault_path);
      }

      if (!handle) {
        const show_picker =
          window.showDirectoryPicker as () => Promise<FileSystemDirectoryHandle>;
        handle = await show_picker();
      }

      const { name, path } = read_vault_metadata(handle);
      const existing = await find_existing_vault_record(handle, path);
      const vault_id = existing?.id ?? generate_vault_id();
      const created_at = existing?.created_at ?? Date.now();

      await store_vault(vault_id, name, path, handle, { created_at });

      return {
        id: vault_id,
        path: as_vault_path(path),
        name,
        created_at,
      };
    },

    async open_vault_by_id(vault_id: VaultId): Promise<Vault> {
      const record = await get_vault(vault_id);
      if (!record) {
        throw new Error(`Vault not found: ${vault_id}`);
      }

      const { name, path, handle, created_at } = record;

      if (
        "requestPermission" in handle &&
        typeof handle.requestPermission === "function"
      ) {
        try {
          await (
            handle as {
              requestPermission: (opts: {
                mode: string;
              }) => Promise<PermissionState>;
            }
          ).requestPermission({ mode: "readwrite" });
        } catch (e) {
          throw new Error(
            `Permission denied for vault: ${vault_id}. ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      return {
        id: vault_id,
        path: as_vault_path(path),
        name,
        created_at,
      };
    },

    async list_vaults(): Promise<Vault[]> {
      const records = await list_stored_vaults();
      return records.map((r) => ({
        id: as_vault_id(r.id),
        path: as_vault_path(r.path),
        name: r.name,
        created_at: r.created_at,
      }));
    },

    remember_last_vault(vault_id: VaultId): Promise<void> {
      localStorage.setItem(LAST_VAULT_KEY, vault_id);
      return Promise.resolve();
    },

    get_last_vault_id(): Promise<VaultId | null> {
      const stored = localStorage.getItem(LAST_VAULT_KEY);
      return Promise.resolve(stored ? as_vault_id(stored) : null);
    },
  };
}
