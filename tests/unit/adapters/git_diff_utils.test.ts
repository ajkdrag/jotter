import { describe, it, expect } from "vitest";
import { compute_line_diff } from "$lib/adapters/web/git_diff_utils";

describe("compute_line_diff", () => {
  it("returns empty hunks for identical text", () => {
    const result = compute_line_diff("hello\nworld", "hello\nworld");
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.hunks).toHaveLength(0);
  });

  it("detects a single addition", () => {
    const result = compute_line_diff("line1\nline3", "line1\nline2\nline3");
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);
    expect(result.hunks).toHaveLength(1);

    const lines = result.hunks[0]?.lines ?? [];
    const added = lines.filter((l) => l.type === "addition");
    expect(added).toHaveLength(1);
    expect(added[0]?.content).toBe("line2");
  });

  it("detects a single deletion", () => {
    const result = compute_line_diff("line1\nline2\nline3", "line1\nline3");
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(1);
    expect(result.hunks).toHaveLength(1);

    const lines = result.hunks[0]?.lines ?? [];
    const deleted = lines.filter((l) => l.type === "deletion");
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.content).toBe("line2");
  });

  it("detects modification as delete + add", () => {
    const result = compute_line_diff("hello\nworld", "hello\nearth");
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(1);
  });

  it("handles empty old text", () => {
    const result = compute_line_diff("", "new line");
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(1);
  });

  it("handles empty new text", () => {
    const result = compute_line_diff("old line", "");
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(1);
  });

  it("groups nearby changes into a single hunk", () => {
    const old_text = "a\nb\nc\nd\ne";
    const new_text = "a\nB\nc\nD\ne";
    const result = compute_line_diff(old_text, new_text);
    expect(result.hunks).toHaveLength(1);
  });

  it("splits distant changes into separate hunks", () => {
    const old_lines = Array.from({ length: 20 }, (_, i) => `line${String(i)}`);
    const new_lines = [...old_lines];
    new_lines[1] = "CHANGED1";
    new_lines[18] = "CHANGED18";

    const result = compute_line_diff(
      old_lines.join("\n"),
      new_lines.join("\n"),
    );
    expect(result.hunks.length).toBeGreaterThanOrEqual(2);
  });

  it("produces correct line numbers", () => {
    const result = compute_line_diff("a\nb\nc", "a\nx\nc");
    const hunk = result.hunks[0];
    expect(hunk).toBeDefined();

    const deletion = hunk?.lines.find((l) => l.type === "deletion");
    const addition = hunk?.lines.find((l) => l.type === "addition");
    expect(deletion?.old_line).toBe(2);
    expect(addition?.new_line).toBe(2);
  });
});
