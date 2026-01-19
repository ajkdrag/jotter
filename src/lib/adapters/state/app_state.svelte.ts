import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { LinksState, OpenNoteState } from '$lib/types/editor'
import type { SearchHit } from '$lib/types/search'

type AppState = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
  search_results: SearchHit[]
  links: LinksState
  conflict: { note_path: string; seen_at_ms: number } | null
}

export const app_state = $state<AppState>({
  vault: null,
  recent_vaults: [],
  notes: [],
  open_note: null,
  search_results: [],
  links: {
    loading: false,
    backlinks: [],
    outlinks: []
  },
  conflict: null
})
