import type { GitDiff, GitDiffHunk, GitDiffLine } from "$lib/types/git";

function compute_lcs_table(
  old_lines: string[],
  new_lines: string[],
): number[][] {
  const m = old_lines.length;
  const n = new_lines.length;
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    const row = table[i];
    const prev_row = table[i - 1];
    if (!row || !prev_row) continue;
    for (let j = 1; j <= n; j++) {
      if (old_lines[i - 1] === new_lines[j - 1]) {
        row[j] = (prev_row[j - 1] ?? 0) + 1;
      } else {
        row[j] = Math.max(prev_row[j] ?? 0, row[j - 1] ?? 0);
      }
    }
  }

  return table;
}

type EditOp = {
  type: "equal" | "delete" | "insert";
  old_idx: number;
  new_idx: number;
};

function backtrack_edits(
  table: number[][],
  old_lines: string[],
  new_lines: string[],
): EditOp[] {
  const ops: EditOp[] = [];
  let i = old_lines.length;
  let j = new_lines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && old_lines[i - 1] === new_lines[j - 1]) {
      ops.push({ type: "equal", old_idx: i - 1, new_idx: j - 1 });
      i--;
      j--;
    } else if (
      j > 0 &&
      (i === 0 || (table[i]?.[j - 1] ?? 0) >= (table[i - 1]?.[j] ?? 0))
    ) {
      ops.push({ type: "insert", old_idx: i, new_idx: j - 1 });
      j--;
    } else {
      ops.push({ type: "delete", old_idx: i - 1, new_idx: j });
      i--;
    }
  }

  return ops.reverse();
}

const CONTEXT_LINES = 3;

export function compute_line_diff(old_text: string, new_text: string): GitDiff {
  const old_lines = old_text.split("\n");
  const new_lines = new_text.split("\n");

  const table = compute_lcs_table(old_lines, new_lines);
  const ops = backtrack_edits(table, old_lines, new_lines);

  let additions = 0;
  let deletions = 0;
  const all_lines: GitDiffLine[] = [];

  let old_line_num = 1;
  let new_line_num = 1;

  for (const op of ops) {
    if (op.type === "equal") {
      all_lines.push({
        type: "context",
        content: old_lines[op.old_idx] ?? "",
        old_line: old_line_num,
        new_line: new_line_num,
      });
      old_line_num++;
      new_line_num++;
    } else if (op.type === "delete") {
      all_lines.push({
        type: "deletion",
        content: old_lines[op.old_idx] ?? "",
        old_line: old_line_num,
        new_line: null,
      });
      old_line_num++;
      deletions++;
    } else {
      all_lines.push({
        type: "addition",
        content: new_lines[op.new_idx] ?? "",
        old_line: null,
        new_line: new_line_num,
      });
      new_line_num++;
      additions++;
    }
  }

  const hunks = build_hunks(all_lines);
  return { additions, deletions, hunks };
}

function build_hunks(lines: GitDiffLine[]): GitDiffHunk[] {
  if (lines.length === 0) return [];

  const change_indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.type !== "context") {
      change_indices.push(i);
    }
  }

  if (change_indices.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  let range_start = Math.max(0, (change_indices[0] ?? 0) - CONTEXT_LINES);
  let range_end = Math.min(
    lines.length - 1,
    (change_indices[0] ?? 0) + CONTEXT_LINES,
  );

  for (let i = 1; i < change_indices.length; i++) {
    const idx = change_indices[i] ?? 0;
    const new_start = Math.max(0, idx - CONTEXT_LINES);
    const new_end = Math.min(lines.length - 1, idx + CONTEXT_LINES);

    if (new_start <= range_end + 1) {
      range_end = new_end;
    } else {
      ranges.push({ start: range_start, end: range_end });
      range_start = new_start;
      range_end = new_end;
    }
  }
  ranges.push({ start: range_start, end: range_end });

  return ranges.map((range) => {
    const hunk_lines = lines.slice(range.start, range.end + 1);
    const first_line = hunk_lines[0];
    const old_start = first_line?.old_line ?? first_line?.new_line ?? 1;
    const new_start = first_line?.new_line ?? first_line?.old_line ?? 1;
    const old_count = hunk_lines.filter((l) => l.type !== "addition").length;
    const new_count = hunk_lines.filter((l) => l.type !== "deletion").length;
    const header = `@@ -${String(old_start)},${String(old_count)} +${String(new_start)},${String(new_count)} @@`;

    return { header, lines: hunk_lines };
  });
}
