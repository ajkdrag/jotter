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
});
