import { describe, expect, it } from "vitest";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { as_vault_id } from "$lib/shared/types/ids";

describe("VaultStore git cache", () => {
  it("sets and retrieves git info for a vault", () => {
    const store = new VaultStore();
    const id = as_vault_id("vault-1");
    const info = { branch: "main", is_dirty: false };

    store.set_vault_git_info(id, info);

    expect(store.get_vault_git_info(id)).toEqual(info);
  });

  it("returns undefined for unknown vault", () => {
    const store = new VaultStore();

    expect(store.get_vault_git_info(as_vault_id("unknown"))).toBeUndefined();
  });

  it("overwrites existing git info", () => {
    const store = new VaultStore();
    const id = as_vault_id("vault-1");

    store.set_vault_git_info(id, { branch: "main", is_dirty: false });
    store.set_vault_git_info(id, { branch: "dev", is_dirty: true });

    expect(store.get_vault_git_info(id)).toEqual({
      branch: "dev",
      is_dirty: true,
    });
  });

  it("clears git cache on reset", () => {
    const store = new VaultStore();
    const id = as_vault_id("vault-1");

    store.set_vault_git_info(id, { branch: "main", is_dirty: false });
    store.reset();

    expect(store.get_vault_git_info(id)).toBeUndefined();
    expect(store.vault_git_cache.size).toBe(0);
  });
});
