import { describe, expect, it } from "vitest";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { create_test_vault } from "../helpers/test_fixtures";
import { as_vault_id } from "$lib/types/ids";

describe("VaultStore", () => {
  it("sets and clears vault while updating generation", () => {
    const store = new VaultStore();
    const initial_generation = store.generation;

    const vault = create_test_vault();
    store.set_vault(vault);

    expect(store.vault).toEqual(vault);
    expect(store.generation).toBe(initial_generation + 1);

    store.clear();

    expect(store.vault).toBeNull();
    expect(store.generation).toBe(initial_generation + 2);
  });

  it("sets recent vaults", () => {
    const store = new VaultStore();
    const vault = create_test_vault();

    store.set_recent_vaults([vault]);

    expect(store.recent_vaults).toEqual([vault]);
  });

  it("bumps generation without changing vault selection", () => {
    const store = new VaultStore();
    const initial_generation = store.generation;

    store.bump_generation();

    expect(store.generation).toBe(initial_generation + 1);
    expect(store.vault).toBeNull();
  });

  it("keeps pinned vaults at the top in pinned order", () => {
    const store = new VaultStore();
    const vault_a = create_test_vault({
      id: as_vault_id("vault-a"),
      last_opened_at: 100,
    });
    const vault_b = create_test_vault({
      id: as_vault_id("vault-b"),
      last_opened_at: 200,
    });
    const vault_c = create_test_vault({
      id: as_vault_id("vault-c"),
      last_opened_at: 300,
    });

    store.set_recent_vaults([vault_c, vault_b, vault_a]);
    store.set_pinned_vault_ids([vault_b.id, vault_a.id]);

    expect(store.recent_vaults.map((vault) => vault.id)).toEqual([
      vault_b.id,
      vault_a.id,
      vault_c.id,
    ]);
    expect(store.get_pinned_vault_id_by_slot(0)).toBe(vault_b.id);
    expect(store.get_pinned_vault_id_by_slot(1)).toBe(vault_a.id);
    expect(store.get_pinned_vault_id_by_slot(2)).toBeNull();
  });

  it("prunes stale pinned ids when recent vaults update", () => {
    const store = new VaultStore();
    const vault_a = create_test_vault({ id: as_vault_id("vault-a") });

    store.set_recent_vaults([vault_a]);
    store.set_pinned_vault_ids([vault_a.id, as_vault_id("vault-missing")]);
    store.set_recent_vaults([vault_a]);

    expect(store.pinned_vault_ids).toEqual([vault_a.id]);
  });

  it("restores recency order after unpinning a vault", () => {
    const store = new VaultStore();
    const vault_a = create_test_vault({
      id: as_vault_id("vault-a"),
      last_opened_at: 300,
    });
    const vault_b = create_test_vault({
      id: as_vault_id("vault-b"),
      last_opened_at: 200,
    });
    const vault_c = create_test_vault({
      id: as_vault_id("vault-c"),
      last_opened_at: 100,
    });

    store.set_recent_vaults([vault_a, vault_b, vault_c]);

    store.toggle_pinned_vault(vault_c.id);
    expect(store.recent_vaults.map((v) => v.id)).toEqual([
      vault_c.id,
      vault_a.id,
      vault_b.id,
    ]);

    store.toggle_pinned_vault(vault_c.id);
    expect(store.recent_vaults.map((v) => v.id)).toEqual([
      vault_a.id,
      vault_b.id,
      vault_c.id,
    ]);
  });
});
