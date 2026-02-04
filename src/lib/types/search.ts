import type { NoteMeta } from '$lib/types/note'

export type SearchScope = 'all' | 'path' | 'title' | 'content'

export type SearchQuery = {
  raw: string
  text: string
  scope: SearchScope
}

export type NoteSearchHit = {
  note: NoteMeta
  score: number
  snippet?: string | undefined
}
