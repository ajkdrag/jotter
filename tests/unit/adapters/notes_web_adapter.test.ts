import { beforeEach, describe, expect, it, vi } from "vitest";
import { as_markdown_text, as_note_path, as_vault_id } from "$lib/types/ids";
import { create_notes_web_adapter } from "$lib/adapters/web/notes_web_adapter";
import * as storage from "$lib/adapters/web/storage";

function create_error(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function to_bytes(value: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  return new Uint8Array(value);
}

class MockFileEntry {
  bytes: Uint8Array;
  last_modified: number;

  constructor(bytes: Uint8Array = new Uint8Array()) {
    this.bytes = bytes;
    this.last_modified = Date.now();
  }
}

class MockFileHandle {
  readonly kind = "file";

  constructor(
    readonly name: string,
    private readonly entry: MockFileEntry,
  ) {}

  async getFile() {
    await Promise.resolve();
    const bytes = new Uint8Array(this.entry.bytes);
    const last_modified = this.entry.last_modified;
    return {
      size: bytes.byteLength,
      lastModified: last_modified,
      text: async () => {
        await Promise.resolve();
        return new TextDecoder().decode(bytes);
      },
      arrayBuffer: async () => {
        await Promise.resolve();
        return bytes.buffer.slice(0);
      },
      slice: (start = 0, end = bytes.byteLength) => {
        const sliced = bytes.slice(start, end);
        return {
          text: async () => {
            await Promise.resolve();
            return new TextDecoder().decode(sliced);
          },
        };
      },
    };
  }

  async createWritable() {
    await Promise.resolve();
    return {
      write: async (value: string | Uint8Array | ArrayBuffer) => {
        await Promise.resolve();
        this.entry.bytes = to_bytes(value);
      },
      close: async () => {
        await Promise.resolve();
        this.entry.last_modified = Date.now();
      },
    };
  }
}

class MockDirectoryHandle {
  readonly kind = "directory";
  readonly directories = new Map<string, MockDirectoryHandle>();
  readonly files = new Map<string, MockFileHandle>();

  constructor(readonly name: string) {}

  async getDirectoryHandle(
    name: string,
    options: { create: boolean },
  ): Promise<MockDirectoryHandle> {
    await Promise.resolve();
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (this.files.has(name)) {
      throw create_error("TypeMismatchError", `Expected directory: ${name}`);
    }
    if (!options.create) {
      throw create_error("NotFoundError", `Directory not found: ${name}`);
    }
    const created = new MockDirectoryHandle(name);
    this.directories.set(name, created);
    return created;
  }

  async getFileHandle(
    name: string,
    options: { create: boolean },
  ): Promise<MockFileHandle> {
    await Promise.resolve();
    const existing = this.files.get(name);
    if (existing) return existing;
    if (this.directories.has(name)) {
      throw create_error("TypeMismatchError", `Expected file: ${name}`);
    }
    if (!options.create) {
      throw create_error("NotFoundError", `File not found: ${name}`);
    }
    const entry = new MockFileEntry();
    const handle = new MockFileHandle(name, entry);
    this.files.set(name, handle);
    return handle;
  }

  async removeEntry(name: string, options?: { recursive?: boolean }) {
    await Promise.resolve();
    if (this.files.delete(name)) return;
    const dir = this.directories.get(name);
    if (!dir) {
      throw create_error("NotFoundError", `Entry not found: ${name}`);
    }
    const has_children = dir.directories.size > 0 || dir.files.size > 0;
    if (has_children && !options?.recursive) {
      throw create_error("InvalidModificationError", "Directory is not empty");
    }
    this.directories.delete(name);
  }

  async *values(): AsyncGenerator<MockDirectoryHandle | MockFileHandle> {
    await Promise.resolve();
    for (const directory of this.directories.values()) {
      yield directory;
    }
    for (const file of this.files.values()) {
      yield file;
    }
  }
}

function split_path(path: string): string[] {
  return path.split("/").filter((part) => part.length > 0);
}

function create_mock_vault_root(): {
  root: MockDirectoryHandle;
  write_text: (path: string, content: string) => Promise<void>;
  write_bytes: (path: string, bytes: Uint8Array) => Promise<void>;
  read_text: (path: string) => Promise<string>;
  read_bytes: (path: string) => Promise<Uint8Array>;
  has_file: (path: string) => Promise<boolean>;
} {
  const root = new MockDirectoryHandle("vault");

  const ensure_parent = async (path: string) => {
    const parts = split_path(path);
    const file_name = parts.pop();
    if (!file_name) throw new Error(`Invalid path: ${path}`);
    let current = root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return { parent: current, file_name };
  };

  return {
    root,
    write_text: async (path, content) => {
      const { parent, file_name } = await ensure_parent(path);
      const file = await parent.getFileHandle(file_name, { create: true });
      const writable = await file.createWritable();
      await writable.write(content);
      await writable.close();
    },
    write_bytes: async (path, bytes) => {
      const { parent, file_name } = await ensure_parent(path);
      const file = await parent.getFileHandle(file_name, { create: true });
      const writable = await file.createWritable();
      await writable.write(bytes);
      await writable.close();
    },
    read_text: async (path) => {
      const parts = split_path(path);
      const file_name = parts.pop();
      if (!file_name) throw new Error(`Invalid path: ${path}`);
      let current = root;
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: false });
      }
      const file = await current.getFileHandle(file_name, { create: false });
      return (await file.getFile()).text();
    },
    read_bytes: async (path) => {
      const parts = split_path(path);
      const file_name = parts.pop();
      if (!file_name) throw new Error(`Invalid path: ${path}`);
      let current = root;
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: false });
      }
      const file = await current.getFileHandle(file_name, { create: false });
      const array_buffer = await (await file.getFile()).arrayBuffer();
      return new Uint8Array(array_buffer);
    },
    has_file: async (path) => {
      try {
        const parts = split_path(path);
        const file_name = parts.pop();
        if (!file_name) return false;
        let current = root;
        for (const part of parts) {
          current = await current.getDirectoryHandle(part, { create: false });
        }
        await current.getFileHandle(file_name, { create: false });
        return true;
      } catch {
        return false;
      }
    },
  };
}

describe("notes_web_adapter", () => {
  const vault_id = as_vault_id("vault-web-notes");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("create_note rejects existing files without overwriting content", async () => {
    const mock_fs = create_mock_vault_root();
    await mock_fs.write_text("docs/existing.md", "# Keep");

    vi.spyOn(storage, "get_vault").mockResolvedValue({
      id: String(vault_id),
      name: "vault",
      path: "vault",
      handle: mock_fs.root as unknown as FileSystemDirectoryHandle,
      created_at: 1,
      last_accessed: 1,
    });

    const adapter = create_notes_web_adapter();
    await expect(
      adapter.create_note(
        vault_id,
        as_note_path("docs/existing.md"),
        as_markdown_text(""),
      ),
    ).rejects.toThrow("note already exists");

    expect(await mock_fs.read_text("docs/existing.md")).toBe("# Keep");
  });

  it("list_notes returns a deterministic sorted order", async () => {
    const mock_fs = create_mock_vault_root();
    await mock_fs.write_text("zeta.md", "# Z");
    await mock_fs.write_text("Alpha.md", "# A");
    await mock_fs.write_text("docs/beta.md", "# B");

    vi.spyOn(storage, "get_vault").mockResolvedValue({
      id: String(vault_id),
      name: "vault",
      path: "vault",
      handle: mock_fs.root as unknown as FileSystemDirectoryHandle,
      created_at: 1,
      last_accessed: 1,
    });

    const adapter = create_notes_web_adapter();
    const notes = await adapter.list_notes(vault_id);

    expect(notes.map((note) => String(note.path))).toEqual([
      "Alpha.md",
      "docs/beta.md",
      "zeta.md",
    ]);
  });

  it("rename_folder fails when destination already exists", async () => {
    const mock_fs = create_mock_vault_root();
    await mock_fs.write_text("docs/note.md", "# One");
    await mock_fs.write_text("archive/other.md", "# Two");

    vi.spyOn(storage, "get_vault").mockResolvedValue({
      id: String(vault_id),
      name: "vault",
      path: "vault",
      handle: mock_fs.root as unknown as FileSystemDirectoryHandle,
      created_at: 1,
      last_accessed: 1,
    });

    const adapter = create_notes_web_adapter();
    await expect(
      adapter.rename_folder(vault_id, "docs", "archive"),
    ).rejects.toThrow("destination already exists");

    expect(await mock_fs.has_file("docs/note.md")).toBe(true);
  });

  it("rename_folder preserves binary files", async () => {
    const mock_fs = create_mock_vault_root();
    const bytes = new Uint8Array([0, 255, 17, 3, 99]);
    await mock_fs.write_bytes("docs/.assets/pic.png", bytes);
    await mock_fs.write_text("docs/note.md", "# Note");

    vi.spyOn(storage, "get_vault").mockResolvedValue({
      id: String(vault_id),
      name: "vault",
      path: "vault",
      handle: mock_fs.root as unknown as FileSystemDirectoryHandle,
      created_at: 1,
      last_accessed: 1,
    });

    const adapter = create_notes_web_adapter();
    await adapter.rename_folder(vault_id, "docs", "archive");

    expect(await mock_fs.has_file("docs/note.md")).toBe(false);
    expect(await mock_fs.read_text("archive/note.md")).toBe("# Note");
    expect(await mock_fs.read_bytes("archive/.assets/pic.png")).toEqual(bytes);
  });
});
