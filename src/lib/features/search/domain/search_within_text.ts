import type { InFileMatch } from "$lib/shared/types/search";

export function search_within_text(text: string, query: string): InFileMatch[] {
  if (!query || !text) return [];

  const matches: InFileMatch[] = [];
  const lower_query = query.toLowerCase();
  const lines = text.split("\n");

  for (let line_idx = 0; line_idx < lines.length; line_idx++) {
    const line = lines[line_idx] ?? "";
    const lower_line = line.toLowerCase();
    let search_start = 0;

    while (search_start < lower_line.length) {
      const col = lower_line.indexOf(lower_query, search_start);
      if (col === -1) break;

      const context_start = Math.max(0, col - 30);
      const context_end = Math.min(line.length, col + query.length + 30);
      let context = line.slice(context_start, context_end);
      if (context_start > 0) context = "..." + context;
      if (context_end < line.length) context = context + "...";

      matches.push({
        line: line_idx + 1,
        column: col + 1,
        length: query.length,
        context,
      });

      search_start = col + 1;
    }
  }

  return matches;
}
