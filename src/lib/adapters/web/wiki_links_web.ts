type KeyToPathMap = Map<string, string>;

const wiki_link_re = /\[\[([^\]]+)\]\]/g;

type NoteReference = {
  path: string;
  title: string;
};

export function normalize_key(value: string): string {
  return value.trim().toLowerCase();
}

export function wiki_link_targets(markdown: string): string[] {
  const out: string[] = [];
  for (const match of markdown.matchAll(wiki_link_re)) {
    const raw = match[1] ?? "";
    const left = raw.split("|")[0] ?? raw;
    const target = (left.split("#")[0] ?? left).trim();
    if (target === "") continue;
    out.push(target);
  }
  return out;
}

export function resolve_wiki_target(
  token: string,
  key_to_path: KeyToPathMap,
): string | null {
  const trimmed = token.trim();
  if (trimmed === "") return null;
  const token_no_ext = trimmed.endsWith(".md") ? trimmed.slice(0, -3) : trimmed;

  if (token_no_ext.includes("/")) {
    const direct = normalize_key(token_no_ext);
    const direct_hit = key_to_path.get(direct);
    if (direct_hit) return direct_hit;

    const direct_md = normalize_key(`${token_no_ext}.md`);
    const direct_md_hit = key_to_path.get(direct_md);
    if (direct_md_hit) return direct_md_hit;
  }

  const k = normalize_key(token_no_ext);
  return key_to_path.get(k) ?? null;
}

export function build_key_map(notes: NoteReference[]): KeyToPathMap {
  const map: KeyToPathMap = new Map();

  for (const note of notes) {
    const path = note.path;
    const stem = path.split("/").at(-1)?.replace(/\.md$/, "") ?? path;
    const path_no_ext = path.endsWith(".md") ? path.slice(0, -3) : path;

    const keys = [
      normalize_key(stem),
      normalize_key(note.title),
      normalize_key(path),
      normalize_key(path_no_ext),
    ];

    for (const key of keys) {
      if (map.has(key)) continue;
      map.set(key, path);
    }
  }

  return map;
}
