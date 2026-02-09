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
      { created_at: 1234 },
    );
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
      { created_at: vault.created_at },
    );
  });
});
