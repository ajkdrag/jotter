import type { NoteMeta } from '$lib/types/note'

export type NoteSearchHit = {
  note: NoteMeta
  score: number
  snippet?: string | undefined
}
