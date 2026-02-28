import { describe, expect, it } from "vitest";
import { format_relative_time } from "$lib/shared/utils/relative_time";

describe("format_relative_time", () => {
  it("formats short deltas as just now", () => {
    const now = 1_700_000_000_000;
    expect(format_relative_time(now - 15_000, now)).toBe("just now");
  });

  it("formats minute and hour deltas", () => {
    const now = 1_700_000_000_000;
    expect(format_relative_time(now - 2 * 60_000, now)).toBe("2m ago");
    expect(format_relative_time(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  it("formats day deltas and older dates", () => {
    const now = Date.UTC(2026, 1, 13, 12, 0, 0);
    expect(format_relative_time(now - 2 * 24 * 60 * 60_000, now)).toBe(
      "2d ago",
    );
    expect(format_relative_time(Date.UTC(2026, 0, 1, 0, 0, 0), now)).toBe(
      "2026-01-01",
    );
  });
});
