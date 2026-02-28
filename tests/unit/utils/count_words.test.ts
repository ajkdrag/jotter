import { describe, it, expect } from "vitest";
import { count_words } from "$lib/shared/utils/count_words";

describe("count_words", () => {
  it("counts words across whitespace", () => {
    expect(count_words("hello world")).toBe(2);
    expect(count_words(" hello   world  ")).toBe(2);
    expect(count_words("a\tb\nc")).toBe(3);
  });

  it("handles empty and whitespace-only input", () => {
    expect(count_words("")).toBe(0);
    expect(count_words("   \n\t")).toBe(0);
  });

  it("treats non-breaking space as whitespace", () => {
    expect(count_words(`hello\u00A0world`)).toBe(2);
  });
});
