import { describe, it, expect } from "vitest";
import { create_test_workspace_index_adapter } from "$lib/shared/adapters/test/test_workspace_index_adapter";
import { as_note_path, as_vault_id } from "$lib/shared/types/ids";

describe("test_workspace_index_adapter", () => {
  it("touch_index resolves", async () => {
    const adapter = create_test_workspace_index_adapter();
    await expect(
      adapter.touch_index(as_vault_id("vault-1"), {
        kind: "force_scan",
      }),
    ).resolves.toBeUndefined();
  });

  it("sync_index resolves", async () => {
    const adapter = create_test_workspace_index_adapter();
    await expect(
      adapter.sync_index(as_vault_id("vault-1")),
    ).resolves.toBeUndefined();
  });

  it("cancel_index resolves", async () => {
    const adapter = create_test_workspace_index_adapter();
    await expect(
      adapter.cancel_index(as_vault_id("vault-1")),
    ).resolves.toBeUndefined();
  });

  it("rebuild_index resolves", async () => {
    const adapter = create_test_workspace_index_adapter();
    await expect(
      adapter.rebuild_index(as_vault_id("vault-1")),
    ).resolves.toBeUndefined();
  });

  it("upsert_note resolves", async () => {
    const adapter = create_test_workspace_index_adapter();
    await expect(
      adapter.upsert_note(as_vault_id("vault-1"), as_note_path("note.md")),
    ).resolves.toBeUndefined();
  });

  it("remove_note resolves", async () => {
    const adapter = create_test_workspace_index_adapter();
    await expect(
      adapter.remove_note(as_vault_id("vault-1"), as_note_path("note.md")),
    ).resolves.toBeUndefined();
  });
});
