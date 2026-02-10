import { parent_folder_path } from "$lib/utils/path";

const WIKI_LINK_PROTOCOL = "jotter:";
const WIKI_LINK_HOST = "wiki";

export function encode_wiki_link_href(note_path: string): string {
  const url = new URL(`${WIKI_LINK_PROTOCOL}//${WIKI_LINK_HOST}`);
  url.searchParams.set("path", note_path);
  return url.toString();
}

export function try_decode_wiki_link_href(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== WIKI_LINK_PROTOCOL) return null;
    if (url.hostname !== WIKI_LINK_HOST) return null;
    const path = url.searchParams.get("path");
    if (!path) return null;
    return path;
  } catch {
    return null;
  }
}

function normalize_path_segments(path: string): string | null {
  const raw_parts = path.split("/").filter(Boolean);
  const parts: string[] = [];

  for (const part of raw_parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

function strip_leading_slash(value: string): string {
  return value.startsWith("/") ? value.slice(1) : value;
}

function strip_md_extension(value: string): string {
  return value.endsWith(".md") ? value.slice(0, -3) : value;
}

function compute_relative_path(from_dir: string, to_path: string): string {
  const from_segments = from_dir === "" ? [] : from_dir.split("/");
  const to_segments = to_path.split("/");

  let common = 0;
  while (
    common < from_segments.length &&
    common < to_segments.length &&
    from_segments[common] === to_segments[common]
  ) {
    common++;
  }

  const ups = from_segments.length - common;
  const remaining = to_segments.slice(common);

  if (ups === 0 && remaining.length === 1) return remaining[0] ?? to_path;
  if (ups === 0) return `./${remaining.join("/")}`;
  return [...Array<string>(ups).fill(".."), ...remaining].join("/");
}

function ensure_md_extension(value: string): string {
  return value.endsWith(".md") ? value : `${value}.md`;
}

export function resolve_wiki_target_to_note_path(input: {
  base_note_path: string;
  raw_target: string;
}): string | null {
  const trimmed = input.raw_target.trim();
  if (trimmed === "") return null;

  const is_explicit_relative =
    trimmed.startsWith("./") || trimmed.startsWith("../");
  const is_absolute = trimmed.startsWith("/");
  const cleaned = strip_leading_slash(trimmed);
  const is_vault_relative = !is_explicit_relative && cleaned.includes("/");

  const base_folder = parent_folder_path(input.base_note_path);
  const combined =
    is_absolute || is_vault_relative || base_folder === ""
      ? cleaned
      : `${base_folder}/${cleaned}`;
  const normalized = normalize_path_segments(combined);
  if (normalized === null || normalized === "") return null;

  const without_ext = strip_md_extension(normalized);
  return ensure_md_extension(without_ext);
}

export function format_wiki_target_for_markdown(input: {
  base_note_path: string;
  resolved_note_path: string;
}): string {
  const normalized = strip_leading_slash(
    normalize_path_segments(input.resolved_note_path) ?? "",
  );
  const base_folder = parent_folder_path(input.base_note_path);
  if (base_folder === "") return strip_md_extension(normalized);
  return strip_md_extension(compute_relative_path(base_folder, normalized));
}

export function format_wiki_target_for_markdown_link(input: {
  base_note_path: string;
  resolved_note_path: string;
}): string {
  const normalized = strip_leading_slash(
    normalize_path_segments(input.resolved_note_path) ?? "",
  );
  const base_folder = parent_folder_path(input.base_note_path);
  if (base_folder === "") return normalized;
  return compute_relative_path(base_folder, normalized);
}

export function does_target_escape_vault(input: {
  base_note_path: string;
  raw_target: string;
}): boolean {
  const trimmed = input.raw_target.trim();
  if (trimmed === "") return false;

  const is_explicit_relative =
    trimmed.startsWith("./") || trimmed.startsWith("../");
  const is_absolute = trimmed.startsWith("/");
  const cleaned = strip_leading_slash(trimmed);
  const is_vault_relative = !is_explicit_relative && cleaned.includes("/");

  const base_folder = parent_folder_path(input.base_note_path);
  const combined =
    is_absolute || is_vault_relative || base_folder === ""
      ? cleaned
      : `${base_folder}/${cleaned}`;
  return normalize_path_segments(combined) === null;
}
