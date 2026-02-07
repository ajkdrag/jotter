import type { NoteSearchHit } from '$lib/types/search'

export type SearchNotesResult =
  | {
      status: 'success'
      results: NoteSearchHit[]
    }
  | {
      status: 'empty'
      results: []
    }
  | {
      status: 'stale'
      results: []
    }
  | {
      status: 'skipped'
      results: []
    }
  | {
      status: 'failed'
      error: string
      results: []
    }
