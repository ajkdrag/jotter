import type { NoteMeta } from '$lib/types/note'
import { parent_folder_path } from '$lib/utils/filetree'

function ascii_lower(value: string): string {
  return value.toLowerCase()
}

function sort_by_path(a: NoteMeta, b: NoteMeta): number {
  if (a.path < b.path) return -1
  if (a.path > b.path) return 1
  return 0
}

export function resolve_existing_note_path(notes: NoteMeta[], target_path: string): string | null {
  const exact = notes.find((n) => n.path === target_path)
  if (exact) return exact.path

  const target_key = ascii_lower(target_path)
  const matches = notes.filter((n) => ascii_lower(n.path) === target_key)
  if (matches.length === 0) return null
  if (matches.length === 1) {
    const match = matches[0]
    if (!match) return null
    return match.path
  }

  const target_parent_key = ascii_lower(parent_folder_path(target_path))
  const same_folder = matches.filter((n) => ascii_lower(parent_folder_path(n.path)) === target_parent_key)
  if (same_folder.length === 1) {
    const match = same_folder[0]
    if (!match) return null
    return match.path
  }

  const deterministic = [...(same_folder.length ? same_folder : matches)].sort(sort_by_path)
  const first = deterministic[0]
  if (!first) return null
  return first.path
}

