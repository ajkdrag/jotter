import type { NoteMeta } from "$lib/types/note";
import { parent_folder_path } from "$lib/utils/filetree";

export function resolve_existing_note_path(
  notes: NoteMeta[],
  target_path: string,
): string | null {
  const exact = notes.find((n) => n.path === target_path);
  if (exact) return exact.path;

  const target_key = target_path.toLowerCase();
  const matches = notes.filter((n) => n.path.toLowerCase() === target_key);
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const match = matches[0];
    if (!match) return null;
    return match.path;
  }

  const target_parent_key = parent_folder_path(target_path).toLowerCase();
  const same_folder = matches.filter(
    (n) => parent_folder_path(n.path).toLowerCase() === target_parent_key,
  );
  if (same_folder.length === 1) {
    const match = same_folder[0];
    if (!match) return null;
    return match.path;
  }

  const deterministic = [...(same_folder.length ? same_folder : matches)].sort(
    (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
  const first = deterministic[0];
  if (!first) return null;
  return first.path;
}
