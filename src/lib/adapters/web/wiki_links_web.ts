const GFM_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;

function decode_uri_component_safe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function markdown_href_target(raw_href: string): string | null {
  const trimmed = raw_href.trim();
  if (!trimmed) return null;

  let href = trimmed;
  if (href.startsWith("<")) {
    const closing_index = href.indexOf(">");
    if (closing_index < 0) return null;
    href = href.slice(1, closing_index).trim();
  } else {
    const title_match = href.match(/^(.+?\.md)(?:\s+["'(].*)?$/i);
    if (!title_match?.[1]) return null;
    href = title_match[1];
  }

  if (/^https?:\/\//i.test(href)) return null;

  const hash_index = href.indexOf("#");
  if (hash_index >= 0) href = href.slice(0, hash_index);
  const query_index = href.indexOf("?");
  if (query_index >= 0) href = href.slice(0, query_index);
  href = decode_uri_component_safe(href.trim());

  if (!href.toLowerCase().endsWith(".md")) return null;
  return href;
}

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
    const href = markdown_href_target(match[2] ?? "");
    if (!href) continue;
    const resolved = resolve_relative_path(source_dir, href);
    if (resolved) out.push(resolved);
  }
  return out;
}
