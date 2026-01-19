import type { NoteMeta } from '$lib/types/note'

export function parse_wiki_links(markdown: string): string[] {
  const re = /\[\[([^\]]+)\]\]/g
  const out: string[] = []
  for (const m of markdown.matchAll(re)) {
    const raw = m[1]?.trim()
    if (!raw) continue
    const left = raw.split('|')[0]?.split('#')[0]?.trim()
    if (!left) continue
    out.push(left)
  }
  return out
}

function normalize_key(s: string): string {
  return s.trim().toLowerCase()
}

function file_stem(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.endsWith('.md') ? file.slice(0, -3) : file
}

export function resolve_wiki_link(notes: NoteMeta[], token: string): NoteMeta | null {
  const t = token.trim()
  if (!t) return null
  const token_no_ext = t.endsWith('.md') ? t.slice(0, -3) : t

  const by_key = new Map<string, NoteMeta>()
  for (const n of notes) {
    const p = String(n.path)
    const k_path = normalize_key(p)
    const k_path_no = normalize_key(p.endsWith('.md') ? p.slice(0, -3) : p)
    const k_stem = normalize_key(file_stem(p))
    const k_title = normalize_key(n.title)
    if (!by_key.has(k_path)) by_key.set(k_path, n)
    if (!by_key.has(k_path_no)) by_key.set(k_path_no, n)
    if (!by_key.has(k_stem)) by_key.set(k_stem, n)
    if (!by_key.has(k_title)) by_key.set(k_title, n)
  }

  if (token_no_ext.includes('/')) {
    const direct = by_key.get(normalize_key(token_no_ext))
    if (direct) return direct
    const direct_md = by_key.get(normalize_key(`${token_no_ext}.md`))
    if (direct_md) return direct_md
  }

  return by_key.get(normalize_key(token_no_ext)) ?? null
}

export function suggest_note_path_for_token(token: string): string {
  const raw = token.trim()
  const with_ext = raw.endsWith('.md') ? raw : `${raw}.md`
  const cleaned = with_ext.replace(/[<>:"|?*]/g, '-')
  const parts = cleaned
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== '.' && p !== '..')
  return parts.join('/')
}

