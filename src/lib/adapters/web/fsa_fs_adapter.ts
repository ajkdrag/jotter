type FsCallback<T> = (err: Error | null, result?: T) => void;

interface FsStatResult {
  type: "file" | "dir";
  size: number;
  mtimeMs: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

function make_stat(
  kind: "file" | "directory",
  size: number,
  mtime_ms: number,
): FsStatResult {
  const type = kind === "file" ? "file" : "dir";
  return {
    type,
    size,
    mtimeMs: mtime_ms,
    isFile: () => kind === "file",
    isDirectory: () => kind === "directory",
    isSymbolicLink: () => false,
  };
}

function split_path(filepath: string): string[] {
  const normalized = filepath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean);
}

async function navigate_to_parent(
  root: FileSystemDirectoryHandle,
  parts: string[],
): Promise<{ parent: FileSystemDirectoryHandle; name: string }> {
  const name = parts[parts.length - 1];
  if (!name) throw new Error(`Invalid path: ${parts.join("/")}`);

  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    current = await current.getDirectoryHandle(part, { create: false });
  }
  return { parent: current, name };
}

async function navigate_to_dir(
  root: FileSystemDirectoryHandle,
  parts: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const part of parts) {
    if (!part) continue;
    current = await current.getDirectoryHandle(part, { create: false });
  }
  return current;
}

async function navigate_to_dir_create(
  root: FileSystemDirectoryHandle,
  parts: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const part of parts) {
    if (!part) continue;
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

function wrap_promise<T>(fn: () => Promise<T>, cb: FsCallback<T>): void {
  fn().then(
    (result) => {
      cb(null, result);
    },
    (err: unknown) => {
      cb(err instanceof Error ? err : new Error(String(err)));
    },
  );
}

export function create_fsa_fs(root: FileSystemDirectoryHandle) {
  const readFile = async (
    filepath: string,
    options?: { encoding?: string },
  ): Promise<Uint8Array | string> => {
    const parts = split_path(filepath);
    if (parts.length === 0) throw new Error("Cannot read root as file");

    const { parent, name } = await navigate_to_parent(root, parts);
    const file_handle = await parent.getFileHandle(name, { create: false });
    const file = await file_handle.getFile();

    if (options?.encoding === "utf8") {
      return await file.text();
    }
    return new Uint8Array(await file.arrayBuffer());
  };

  const writeFile = async (
    filepath: string,
    data: Uint8Array | string,
  ): Promise<void> => {
    const parts = split_path(filepath);
    if (parts.length === 0) throw new Error("Cannot write to root");

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      current = await current.getDirectoryHandle(part, { create: true });
    }

    const name = parts[parts.length - 1];
    if (!name) throw new Error(`Invalid path: ${filepath}`);
    const file_handle = await current.getFileHandle(name, { create: true });
    const writable = await file_handle.createWritable();
    if (typeof data === "string") {
      await writable.write(data);
    } else {
      const buf = new ArrayBuffer(data.byteLength);
      new Uint8Array(buf).set(data);
      await writable.write(buf);
    }
    await writable.close();
  };

  const unlink = async (filepath: string): Promise<void> => {
    const parts = split_path(filepath);
    if (parts.length === 0) throw new Error("Cannot unlink root");

    const { parent, name } = await navigate_to_parent(root, parts);
    await parent.removeEntry(name);
  };

  const readdir = async (filepath: string): Promise<string[]> => {
    const parts = split_path(filepath);
    const dir = await navigate_to_dir(root, parts);
    const names: string[] = [];
    for await (const handle of dir.values()) {
      names.push(handle.name);
    }
    return names;
  };

  const mkdir = async (filepath: string): Promise<void> => {
    const parts = split_path(filepath);
    await navigate_to_dir_create(root, parts);
  };

  const rmdir = async (filepath: string): Promise<void> => {
    const parts = split_path(filepath);
    if (parts.length === 0) throw new Error("Cannot rmdir root");

    const { parent, name } = await navigate_to_parent(root, parts);
    await parent.removeEntry(name, { recursive: true });
  };

  const stat = async (filepath: string): Promise<FsStatResult> => {
    const parts = split_path(filepath);

    if (parts.length === 0) {
      return make_stat("directory", 0, 0);
    }

    const { parent, name } = await navigate_to_parent(root, parts);

    try {
      const file_handle = await parent.getFileHandle(name, { create: false });
      const file = await file_handle.getFile();
      return make_stat("file", file.size, file.lastModified);
    } catch {
      const dir_handle = await parent.getDirectoryHandle(name, {
        create: false,
      });
      if (dir_handle) {
        return make_stat("directory", 0, 0);
      }
      throw new Error(`ENOENT: no such file or directory, stat '${filepath}'`);
    }
  };

  return {
    promises: {
      readFile,
      writeFile,
      unlink,
      readdir,
      mkdir,
      rmdir,
      stat,
      lstat: stat,
    },
    readFile(
      filepath: string,
      options: { encoding?: string } | FsCallback<Uint8Array | string>,
      cb?: FsCallback<Uint8Array | string>,
    ) {
      const callback = typeof options === "function" ? options : cb;
      const opts = typeof options === "function" ? undefined : options;
      if (!callback) throw new Error("Callback required");
      wrap_promise(() => readFile(filepath, opts), callback);
    },
    writeFile(
      filepath: string,
      data: Uint8Array | string,
      options: { encoding?: string } | FsCallback<void>,
      cb?: FsCallback<void>,
    ) {
      const callback = typeof options === "function" ? options : cb;
      if (!callback) throw new Error("Callback required");
      wrap_promise(() => writeFile(filepath, data), callback);
    },
    unlink(filepath: string, cb: FsCallback<void>) {
      wrap_promise(() => unlink(filepath), cb);
    },
    readdir(filepath: string, cb: FsCallback<string[]>) {
      wrap_promise(() => readdir(filepath), cb);
    },
    mkdir(filepath: string, cb: FsCallback<void>) {
      wrap_promise(() => mkdir(filepath), cb);
    },
    rmdir(filepath: string, cb: FsCallback<void>) {
      wrap_promise(() => rmdir(filepath), cb);
    },
    stat(filepath: string, cb: FsCallback<FsStatResult>) {
      wrap_promise(() => stat(filepath), cb);
    },
    lstat(filepath: string, cb: FsCallback<FsStatResult>) {
      wrap_promise(() => stat(filepath), cb);
    },
  };
}

export type FsAdapter = ReturnType<typeof create_fsa_fs>;
