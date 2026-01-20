import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import { as_note_path, type NoteId, type VaultId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { SearchHit } from '$lib/types/search'
import { create_test_notes_adapter } from './test_notes_adapter'

type IndexEntry = {
  note: NoteMeta
  content: string
  words: Set<string>
}

type LinkGraph = Map<string, Set<string>>

class TestWorkspaceIndex {
  private entries: Map<string, IndexEntry> = new Map()
  private link_graph: LinkGraph = new Map()
  private vault_id: VaultId

  constructor(vault_id: VaultId) {
    this.vault_id = vault_id
  }

  add(note: NoteMeta, content: string): void {
    const words = this.extract_words(content)
    this.entries.set(note.id, { note, content, words })

    const links = this.extract_links(content)
    this.link_graph.set(note.id, links)
  }

  search(query: string): SearchHit[] {
    const query_words = this.extract_words(query.toLowerCase())
    if (query_words.size === 0) return []

    const hits: SearchHit[] = []

    for (const entry of this.entries.values()) {
      let score = 0
      let match_count = 0

      for (const word of query_words) {
        if (entry.words.has(word)) {
          score += 1
          match_count += 1
        }
      }

      if (match_count > 0) {
        const normalized_score = score / query_words.size
        const snippet = this.extract_snippet(entry.content, query_words)

        hits.push({
          note: entry.note,
          score: normalized_score,
          ...(snippet ? { snippet } : {})
        })
      }
    }

    return hits.sort((a, b) => b.score - a.score)
  }

  backlinks(target_note_id: NoteId): NoteMeta[] {
    const backlinks: NoteMeta[] = []

    for (const [note_id, links] of this.link_graph.entries()) {
      if (links.has(target_note_id)) {
        const entry = this.entries.get(note_id)
        if (entry) {
          backlinks.push(entry.note)
        }
      }
    }

    return backlinks
  }

  outlinks(note_id: NoteId): NoteMeta[] {
    const links = this.link_graph.get(note_id) ?? new Set()
    const outlinks: NoteMeta[] = []

    for (const link_id of links) {
      const entry = this.entries.get(link_id)
      if (entry) {
        outlinks.push(entry.note)
      }
    }

    return outlinks
  }

  clear(): void {
    this.entries.clear()
    this.link_graph.clear()
  }

  private extract_words(text: string): Set<string> {
    const words = new Set<string>()
    const normalized = text.toLowerCase()
    const word_regex = /\b[a-z0-9]+\b/gi

    let match
    while ((match = word_regex.exec(normalized)) !== null) {
      if (match[0].length > 2) {
        words.add(match[0])
      }
    }

    return words
  }

  private extract_links(content: string): Set<string> {
    const links = new Set<string>()
    const wiki_link_regex = /\[\[([^\]]+)\]\]/g
    const markdown_link_regex = /\[([^\]]+)\]\(([^)]+)\)/g

    let match
    while ((match = wiki_link_regex.exec(content)) !== null) {
      const link_text = match[1]?.split('|')[0]?.trim()
      if (link_text) {
        links.add(as_note_path(link_text))
      }
    }

    while ((match = markdown_link_regex.exec(content)) !== null) {
      const link_url = match[2]?.trim()
      if (link_url && !link_url.startsWith('http') && !link_url.startsWith('imdown-asset://')) {
        links.add(as_note_path(link_url.replace(/\.md$/, '')))
      }
    }

    return links
  }

  private extract_snippet(content: string, query_words: Set<string>, max_length: number = 150): string | undefined {
    const lower_content = content.toLowerCase()
    let best_pos = -1
    let best_score = 0

    for (const word of query_words) {
      const pos = lower_content.indexOf(word)
      if (pos !== -1 && (best_pos === -1 || pos < best_pos)) {
        best_pos = pos
        best_score = 1
      }
    }

    if (best_pos === -1) {
      return content.slice(0, max_length) + (content.length > max_length ? '...' : '')
    }

    const start = Math.max(0, best_pos - 50)
    const end = Math.min(content.length, start + max_length)
    let snippet = content.slice(start, end)

    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'

    return snippet
  }
}

const index_cache = new Map<VaultId, TestWorkspaceIndex>()

export function create_test_workspace_index_adapter(): WorkspaceIndexPort {
  return {
    async build_index(vault_id: VaultId): Promise<void> {
      const notes_adapter = create_test_notes_adapter()
      const notes = await notes_adapter.list_notes(vault_id)

      let index = index_cache.get(vault_id)
      if (!index) {
        index = new TestWorkspaceIndex(vault_id)
        index_cache.set(vault_id, index)
      } else {
        index.clear()
      }

      for (const note of notes) {
        try {
          const doc = await notes_adapter.read_note(vault_id, note.id)
          index.add(note, doc.markdown)
        } catch (e) {
          console.warn(`Failed to index note ${note.id}:`, e)
        }
      }
    },

    async search(vault_id: VaultId, query: string): Promise<SearchHit[]> {
      const index = index_cache.get(vault_id)
      if (!index) {
        return []
      }

      return index.search(query)
    },

    async backlinks(vault_id: VaultId, note_id: NoteId): Promise<NoteMeta[]> {
      const index = index_cache.get(vault_id)
      if (!index) {
        return []
      }

      return index.backlinks(note_id)
    },

    async outlinks(vault_id: VaultId, note_id: NoteId): Promise<NoteMeta[]> {
      const index = index_cache.get(vault_id)
      if (!index) {
        return []
      }

      return index.outlinks(note_id)
    }
  }
}
