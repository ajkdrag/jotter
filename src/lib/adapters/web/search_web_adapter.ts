import MiniSearch from 'minisearch'
import type { SearchPort } from '$lib/ports/search_port'
import type { VaultId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { NoteSearchHit } from '$lib/types/search'

type NoteDocument = {
  id: string
  title: string
  path: string
}

type GetNotesForVault = (vault_id: VaultId) => NoteMeta[]

export function create_search_web_adapter(get_notes: GetNotesForVault): SearchPort {
  return {
    async search_notes(vault_id: VaultId, query: string, limit = 50): Promise<NoteSearchHit[]> {
      const notes = get_notes(vault_id)

      if (!query.trim()) {
        return []
      }

      const mini = new MiniSearch<NoteDocument>({
        fields: ['title', 'path'],
        storeFields: ['title', 'path'],
        searchOptions: {
          boost: { title: 2 },
          fuzzy: 0.2,
          prefix: true
        }
      })

      const docs: NoteDocument[] = notes.map((n) => ({
        id: n.id,
        title: n.title,
        path: n.path
      }))

      mini.addAll(docs)

      const results = mini.search(query).slice(0, limit)
      const notes_map = new Map(notes.map((n) => [n.id, n]))

      return results.map((r) => {
        const note = notes_map.get(r.id)!
        return {
          note,
          score: r.score
        }
      })
    }
  }
}
