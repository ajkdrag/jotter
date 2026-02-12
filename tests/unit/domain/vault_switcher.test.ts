import { describe, expect, it } from "vitest";
import {
  clamp_vault_selection,
  move_vault_selection,
} from "$lib/domain/vault_switcher";

describe("vault_switcher", () => {
  it("clamps selection to bounds", () => {
    expect(clamp_vault_selection(-1, 3)).toBe(0);
    expect(clamp_vault_selection(1, 3)).toBe(1);
    expect(clamp_vault_selection(10, 3)).toBe(2);
    expect(clamp_vault_selection(0, 0)).toBe(-1);
  });

  it("moves selection with wrap-around", () => {
    expect(move_vault_selection(0, 3, 1)).toBe(1);
    expect(move_vault_selection(2, 3, 1)).toBe(0);
    expect(move_vault_selection(0, 3, -1)).toBe(2);
  });

  it("starts from first or last when nothing selected", () => {
    expect(move_vault_selection(-1, 3, 1)).toBe(0);
    expect(move_vault_selection(-1, 3, -1)).toBe(2);
    expect(move_vault_selection(-1, 0, 1)).toBe(-1);
  });
});
