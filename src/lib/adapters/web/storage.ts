const DB_NAME = "jotter_vaults";
const DB_VERSION = 1;
const STORE_NAME = "vaults";

export type VaultRecord = {
  id: string;
  name: string;
  path: string;
  handle: FileSystemDirectoryHandle;
  created_at: number;
  last_accessed: number;
  note_count: number | null;
};

type StoreVaultOptions = {
  created_at?: number;
  last_accessed?: number;
  note_count?: number | null;
};

async function open_db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(
        request.error
          ? new Error(request.error.message || "IndexedDB open failed")
          : new Error("IndexedDB open failed"),
      );
    };
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function store_vault(
  id: string,
  name: string,
  path: string,
  handle: FileSystemDirectoryHandle,
  options: StoreVaultOptions = {},
): Promise<void> {
  const db = await open_db();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const record: VaultRecord = {
    id,
    name,
    path,
    handle,
    created_at: options.created_at ?? Date.now(),
    last_accessed: options.last_accessed ?? Date.now(),
    note_count: options.note_count ?? null,
  };

  return new Promise<void>((resolve, reject) => {
    const request = store.put(record);
    request.onerror = () => {
      reject(
        request.error
          ? new Error(request.error.message || "IndexedDB put failed")
          : new Error("IndexedDB put failed"),
      );
    };
    tx.onerror = () => {
      reject(
        tx.error
          ? new Error(tx.error.message || "IndexedDB transaction failed")
          : new Error("IndexedDB transaction failed"),
      );
    };
    tx.oncomplete = () => {
      resolve();
    };
  });
}

export async function get_vault(id: string): Promise<VaultRecord | null> {
  const db = await open_db();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onerror = () => {
      reject(
        request.error
          ? new Error(request.error.message || "IndexedDB get failed")
          : new Error("IndexedDB get failed"),
      );
    };
    request.onsuccess = () => {
      const result = request.result as VaultRecord | undefined;
      if (result) {
        const normalized: VaultRecord = {
          ...result,
          note_count:
            typeof result.note_count === "number" ? result.note_count : null,
        };
        void store_vault(result.id, result.name, result.path, result.handle, {
          created_at: normalized.created_at,
          last_accessed: Date.now(),
          note_count: normalized.note_count,
        });
        resolve(normalized);
        return;
      }
      resolve(null);
    };
  });
}

export async function list_vaults(): Promise<VaultRecord[]> {
  const db = await open_db();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => {
      reject(
        request.error
          ? new Error(request.error.message || "IndexedDB getAll failed")
          : new Error("IndexedDB getAll failed"),
      );
    };
    request.onsuccess = () => {
      const results = request.result as VaultRecord[];
      const normalized = results.map((record) => ({
        ...record,
        note_count:
          typeof record.note_count === "number" ? record.note_count : null,
      }));
      resolve(normalized.sort((a, b) => b.last_accessed - a.last_accessed));
    };
  });
}

export async function remove_vault(id: string): Promise<void> {
  const db = await open_db();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  return new Promise<void>((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => {
      reject(
        request.error
          ? new Error(request.error.message || "IndexedDB delete failed")
          : new Error("IndexedDB delete failed"),
      );
    };
    request.onsuccess = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(
        tx.error
          ? new Error(tx.error.message || "IndexedDB transaction failed")
          : new Error("IndexedDB transaction failed"),
      );
    };
    tx.oncomplete = () => {
      resolve();
    };
  });
}
