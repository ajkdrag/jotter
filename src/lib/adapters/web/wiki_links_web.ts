const GFM_LINK_RE = /(?<!!)\[([^\]]*)\]\((?!https?:\/\/)([^)]+\.md)\)/g;

export function resolve_relative_path(
  source_dir: string,
  target: string,
): string | null {
  const clean = target.startsWith("./") ? target.slice(2) : target;
  const base_segments =
    source_dir === "" ? [] : source_dir.split("/").filter(Boolean);
  const target_segments = clean.split("/").filter(Boolean);

  const result: string[] = [...base_segments];
  for (const segment of target_segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      if (result.length === 0) return null;
      result.pop();
      continue;
    }
    result.push(segment);
  }

  return result.length === 0 ? null : result.join("/");
}

export function gfm_link_targets(
  markdown: string,
  source_path: string,
): string[] {
  const slash = source_path.lastIndexOf("/");
  const source_dir = slash >= 0 ? source_path.slice(0, slash) : "";

  const out: string[] = [];
  for (const match of markdown.matchAll(GFM_LINK_RE)) {
    const href = match[2]?.trim();
    if (!href) continue;
    const resolved = resolve_relative_path(source_dir, href);
    if (resolved) out.push(resolved);
  }
  return out;
}
