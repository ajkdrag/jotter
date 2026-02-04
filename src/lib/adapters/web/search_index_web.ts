import MiniSearch from 'minisearch'
import type { NoteId, VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'
import type { NoteSearchHit, SearchQuery } from '$lib/types/search'

type NoteDocument = {
  id: string
  title: string
  path: string
  body: string
}

type IndexState = {
  mini: MiniSearch<NoteDocument>
  notes: Map<NoteId, NoteMeta>
  markdown: Map<NoteId, string>
}

export type SearchIndexWeb = {
  build_index: (vault_id: VaultId, docs: NoteDoc[]) => void
  upsert_note: (vault_id: VaultId, doc: NoteDoc) => void
  remove_note: (vault_id: VaultId, note_id: NoteId) => void
  search: (vault_id: VaultId, query: SearchQuery, limit: number) => NoteSearchHit[]
}

const base_boost = { title: 2, path: 1.5, body: 1 }

function create_mini(): MiniSearch<NoteDocument> {
  return new MiniSearch<NoteDocument>({
    fields: ['title', 'path', 'body'],
    storeFields: [],
    searchOptions: {
      prefix: true,
      boost: base_boost
    }
  })
}

function to_document(doc: NoteDoc): NoteDocument {
  return {
    id: doc.meta.id,
    title: doc.meta.title,
    path: doc.meta.path,
    body: doc.markdown
  }
}

function build_snippet(markdown: string, query: string): string | undefined {
  const text = markdown.replace(/\s+/g, ' ').trim()
  if (!text) return undefined

  const q = query.trim().toLowerCase()
  if (!q) return undefined

  const lower = text.toLowerCase()
  let idx = lower.indexOf(q)
  if (idx < 0) {
    const parts = q.split(/\s+/).filter(Boolean)
    for (const part of parts) {
      idx = lower.indexOf(part)
      if (idx >= 0) break
    }
  }

  if (idx < 0) return undefined

  const start = Math.max(0, idx - 60)
  const end = Math.min(text.length, idx + q.length + 60)
  let snippet = text.slice(start, end).trim()
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  return snippet
}

export function create_search_index_web(): SearchIndexWeb {
  const states = new Map<VaultId, IndexState>()

  function get_state(vault_id: VaultId): IndexState {
    const existing = states.get(vault_id)
    if (existing) return existing
    const created = { mini: create_mini(), notes: new Map(), markdown: new Map() }
    states.set(vault_id, created)
    return created
  }

  return {
    build_index(vault_id: VaultId, docs: NoteDoc[]) {
      const state: IndexState = { mini: create_mini(), notes: new Map(), markdown: new Map() }
      const documents = docs.map((doc) => {
        state.notes.set(doc.meta.id, doc.meta)
        state.markdown.set(doc.meta.id, doc.markdown)
        return to_document(doc)
      })
      if (documents.length > 0) {
        state.mini.addAll(documents)
      }
      states.set(vault_id, state)
    },

    upsert_note(vault_id: VaultId, doc: NoteDoc) {
      const state = get_state(vault_id)
      if (state.notes.has(doc.meta.id)) {
        state.mini.discard(doc.meta.id)
      }
      state.notes.set(doc.meta.id, doc.meta)
      state.markdown.set(doc.meta.id, doc.markdown)
      state.mini.add(to_document(doc))
    },

    remove_note(vault_id: VaultId, note_id: NoteId) {
      const state = states.get(vault_id)
      if (!state) return
      if (state.notes.has(note_id)) {
        state.mini.discard(note_id)
      }
      state.notes.delete(note_id)
      state.markdown.delete(note_id)
    },

    search(vault_id: VaultId, query: SearchQuery, limit: number): NoteSearchHit[] {
      const state = states.get(vault_id)
      if (!state) return []
      const text = query.text.trim()
      if (!text) return []

      const options: Parameters<MiniSearch<NoteDocument>['search']>[1] = {
        prefix: true
      }

      if (query.scope === 'all') {
        options.boost = base_boost
      } else if (query.scope === 'path') {
        options.fields = ['path']
      } else if (query.scope === 'title') {
        options.fields = ['title']
      } else {
        options.fields = ['body']
      }

      const results = state.mini.search(text, options).slice(0, limit)
      return results
        .map((result): NoteSearchHit | null => {
          const note_id = result.id as NoteId
          const note = state.notes.get(note_id)
          if (!note) return null
          const markdown = state.markdown.get(note_id)
          const snippet =
            markdown && (query.scope === 'content' || query.scope === 'all')
              ? build_snippet(markdown, text)
              : undefined
          if (snippet) {
            return { note, score: result.score, snippet }
          }
          return { note, score: result.score }
        })
        .filter((hit): hit is NoteSearchHit => hit !== null)
    }
  }
}
