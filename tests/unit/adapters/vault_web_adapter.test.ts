import { beforeEach, describe, expect, it, vi } from "vitest";
import { as_vault_id, as_vault_path } from "$lib/types/ids";
import { create_vault_web_adapter } from "$lib/adapters/web/vault_web_adapter";
import * as storage from "$lib/adapters/web/storage";

class MockDirectoryHandle {
  readonly kind = "directory";

  constructor(
    readonly name: string,
    private readonly key: string,
  ) {}

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    await Promise.resolve();
    const candidate = other as unknown as MockDirectoryHandle;
    return candidate.key === this.key;
  }
}

describe("vault_web_adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!("window" in globalThis)) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: globalThis,
      });
    }
  });

  it("reuses stored vault identity when the picked handle matches an existing vault", async () => {
    const picked_handle = new MockDirectoryHandle("notes", "same");
    const stored_handle = new MockDirectoryHandle("notes", "same");

    Object.defineProperty(globalThis.window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockResolvedValue(
          picked_handle as unknown as FileSystemDirectoryHandle,
        ),
    });

    const list_vaults = vi.spyOn(storage, "list_vaults").mockResolvedValue([
      {
        id: "web_existing",
        name: "notes",
        path: "notes",
        handle: stored_handle as unknown as FileSystemDirectoryHandle,
        created_at: 1234,
        last_accessed: 4567,
        note_count: null,
      },
    ]);
    const store_vault = vi
      .spyOn(storage, "store_vault")
      .mockResolvedValue(undefined);

    const adapter = create_vault_web_adapter();
    const vault = await adapter.open_vault(as_vault_path("notes"));

    expect(list_vaults).toHaveBeenCalledTimes(1);
    expect(vault.id).toBe(as_vault_id("web_existing"));
    expect(vault.created_at).toBe(1234);
    expect(store_vault).toHaveBeenCalledWith(
      as_vault_id("web_existing"),
      "notes",
      "notes",
      picked_handle,
      expect.objectContaining({
        created_at: 1234,
        note_count: null,
      }),
    );
    expect(vault.last_opened_at).toBeTypeOf("number");
    expect(vault.note_count).toBeNull();
    expect(vault.is_available).toBe(true);
  });

  it("creates a new vault identity when no stored vault matches", async () => {
    const picked_handle = new MockDirectoryHandle("notes", "new");

    Object.defineProperty(globalThis.window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: vi
        .fn()
        .mockResolvedValue(
          picked_handle as unknown as FileSystemDirectoryHandle,
        ),
    });

    vi.spyOn(storage, "list_vaults").mockResolvedValue([]);
    const store_vault = vi
      .spyOn(storage, "store_vault")
      .mockResolvedValue(undefined);

    const adapter = create_vault_web_adapter();
    const vault = await adapter.open_vault(as_vault_path("notes"));

    expect(String(vault.id).startsWith("web_")).toBe(true);
    expect(store_vault).toHaveBeenCalledWith(
      vault.id,
      "notes",
      "notes",
      picked_handle,
      expect.objectContaining({
        created_at: vault.created_at,
        note_count: null,
      }),
    );
    expect(vault.last_opened_at).toBeTypeOf("number");
    expect(vault.note_count).toBeNull();
    expect(vault.is_available).toBe(true);
  });

  it("maps last opened and note count from storage", async () => {
    vi.spyOn(storage, "list_vaults").mockResolvedValue([
      {
        id: "web_existing",
        name: "notes",
        path: "notes",
        handle: new MockDirectoryHandle(
          "notes",
          "same",
        ) as unknown as FileSystemDirectoryHandle,
        created_at: 1234,
        last_accessed: 4321,
        note_count: 7,
      },
    ]);

    const adapter = create_vault_web_adapter();
    const vaults = await adapter.list_vaults();

    expect(vaults).toEqual([
      {
        id: as_vault_id("web_existing"),
        name: "notes",
        path: as_vault_path("notes"),
        created_at: 1234,
        last_opened_at: 4321,
        note_count: 7,
        is_available: true,
      },
    ]);
  });

  it("marks vault unavailable when stored handle cannot be accessed", async () => {
    const inaccessible_handle = {
      kind: "directory",
      name: "notes",
      values: vi.fn().mockImplementation(function () {
        throw new Error("NotFoundError");
      }),
    } as unknown as FileSystemDirectoryHandle;

    vi.spyOn(storage, "list_vaults").mockResolvedValue([
      {
        id: "web_missing",
        name: "Missing Vault",
        path: "missing-vault",
        handle: inaccessible_handle,
        created_at: 1234,
        last_accessed: 4321,
        note_count: 3,
      },
    ]);

    const adapter = create_vault_web_adapter();
    const vaults = await adapter.list_vaults();

    expect(vaults[0]).toMatchObject({
      id: as_vault_id("web_missing"),
      is_available: false,
    });
  });

  it("removes vault from storage and clears last vault id", async () => {
    vi.spyOn(storage, "remove_vault").mockResolvedValue(undefined);
    const entries = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
          entries.set(key, value);
        },
        removeItem: (key: string) => {
          entries.delete(key);
        },
      },
    });
    localStorage.setItem("jotter_last_vault_id", "web_existing");

    const adapter = create_vault_web_adapter();
    await adapter.remove_vault(as_vault_id("web_existing"));

    expect(storage.remove_vault).toHaveBeenCalledWith(
      as_vault_id("web_existing"),
    );
    expect(localStorage.getItem("jotter_last_vault_id")).toBeNull();
  });
});
