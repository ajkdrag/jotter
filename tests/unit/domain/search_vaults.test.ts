import { describe, expect, it } from "vitest";
import { search_vaults } from "$lib/domain/search_vaults";
import { as_vault_id, as_vault_path } from "$lib/types/ids";

describe("search_vaults", () => {
  const vaults = [
    {
      id: as_vault_id("vault-dev"),
      name: "Dev Journal",
      path: as_vault_path("/Users/a/vaults/dev-journal"),
      created_at: 1,
    },
    {
      id: as_vault_id("vault-research"),
      name: "Research Notes",
      path: as_vault_path("/Users/a/vaults/research"),
      created_at: 1,
    },
  ];

  it("returns full list for empty query", () => {
    expect(search_vaults(vaults, "  ")).toEqual(vaults);
  });

  it("matches by vault name", () => {
    expect(search_vaults(vaults, "dev")).toEqual([vaults[0]]);
  });

  it("matches by vault path", () => {
    expect(search_vaults(vaults, "research")).toEqual([vaults[1]]);
  });

  it("matches non-contiguous query terms by fuzzy subsequence", () => {
    expect(search_vaults(vaults, "dvj")).toEqual([vaults[0]]);
  });

  it("ranks stronger name matches before path-only matches", () => {
    const ranked = search_vaults(
      [
        {
          id: as_vault_id("vault-alpha"),
          name: "Knowledge Base",
          path: as_vault_path("/Users/a/vaults/machine-learning"),
          created_at: 1,
        },
        {
          id: as_vault_id("vault-beta"),
          name: "Machine Learning",
          path: as_vault_path("/Users/a/vaults/notes"),
          created_at: 1,
        },
      ],
      "machine learning",
    );

    expect(ranked.map((vault) => vault.id)).toEqual([
      as_vault_id("vault-beta"),
      as_vault_id("vault-alpha"),
    ]);
  });

  it("requires all query terms to match", () => {
    expect(search_vaults(vaults, "dev missing")).toEqual([]);
  });
});
