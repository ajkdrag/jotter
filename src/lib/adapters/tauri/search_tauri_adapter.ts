import type { SearchPort } from '$lib/ports/search_port'
import type { VaultId, NoteId } from '$lib/types/ids'
import type { NoteSearchHit } from '$lib/types/search'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'

type TauriSearchHit = {
  note: {
    id: string
    path: string
    title: string
    mtime_ms: number
    size_bytes: number
  }
  score: number
  snippet: string | null
}

export function create_search_tauri_adapter(): SearchPort {
  return {
    async search_notes(vault_id: VaultId, query: string, limit = 50): Promise<NoteSearchHit[]> {
      const hits = await tauri_invoke<TauriSearchHit[]>('index_search', { vaultId: vault_id, query })
      return hits.slice(0, limit).map((hit) => ({
        note: {
          id: hit.note.id as NoteId,
          path: hit.note.path as NoteId,
          title: hit.note.title,
          mtime_ms: hit.note.mtime_ms,
          size_bytes: hit.note.size_bytes
        },
        score: hit.score,
        snippet: hit.snippet ?? undefined
      }))
    }
  }
}
