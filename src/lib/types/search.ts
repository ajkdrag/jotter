import type { NoteMeta } from '$lib/types/note'

export type SearchHit = {
  note: NoteMeta
  score: number
  snippet?: string
}

