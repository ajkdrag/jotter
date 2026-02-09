function file_stem(path: string): string {
  const leaf = path.split("/").filter(Boolean).at(-1) ?? path;
  if (leaf.endsWith(".md")) {
    return leaf.slice(0, -3);
  }
  return leaf;
}

export function extract_note_title(
  markdown: string,
  note_path: string,
): string {
  for (const line of markdown.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    if (trimmed.startsWith("# ")) {
      const title = trimmed.slice(2).trim();
      if (title !== "") {
        return title;
      }
    }
    break;
  }

  return file_stem(note_path);
}
