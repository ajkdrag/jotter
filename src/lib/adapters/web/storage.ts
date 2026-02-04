const DB_NAME = 'imdown_vaults'
const DB_VERSION = 1
const STORE_NAME = 'vaults'

type VaultRecord = {
  id: string
  name: string
  path: string
  handle: FileSystemDirectoryHandle
  created_at: number
  last_accessed: number
}

async function open_db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => { reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB open failed')); }
    request.onsuccess = () => { resolve(request.result); }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

export async function store_vault(
  id: string,
  name: string,
  path: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await open_db()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const record: VaultRecord = {
    id,
    name,
    path,
    handle,
    created_at: Date.now(),
    last_accessed: Date.now()
  }

  return new Promise<void>((resolve, reject) => {
    const request = store.put(record)
    request.onerror = () => { reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB put failed')); }
    request.onsuccess = () => { resolve(); }
    tx.onerror = () => { reject(tx.error ? new Error(String(tx.error)) : new Error('IndexedDB transaction failed')); }
    tx.oncomplete = () => { resolve(); }
  })
}

export async function get_vault(id: string): Promise<VaultRecord | null> {
  const db = await open_db()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onerror = () => { reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB get failed')); }
    request.onsuccess = () => {
      const result = request.result as VaultRecord | undefined
      if (result) {
        result.last_accessed = Date.now()
        void store_vault(result.id, result.name, result.path, result.handle)
      }
      resolve(result ?? null)
    }
  })
}

export async function list_vaults(): Promise<VaultRecord[]> {
  const db = await open_db()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onerror = () => { reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB getAll failed')); }
    request.onsuccess = () => {
      const results = (request.result as VaultRecord[])
      resolve(results.sort((a, b) => b.last_accessed - a.last_accessed))
    }
  })
}

export async function remove_vault(id: string): Promise<void> {
  const db = await open_db()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise<void>((resolve, reject) => {
    const request = store.delete(id)
    request.onerror = () => { reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB delete failed')); }
    request.onsuccess = () => { resolve(); }
    tx.onerror = () => { reject(tx.error ? new Error(String(tx.error)) : new Error('IndexedDB transaction failed')); }
    tx.oncomplete = () => { resolve(); }
  })
}
