import type { NotesPort } from '$lib/ports/notes_port'
import { as_markdown_text, as_note_path, type MarkdownText, type NoteId, type NotePath, type VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'

const TEST_FILES_BASE = '/test/files'

async function discover_test_files(): Promise<string[]> {
  try {
    const response = await fetch(`${TEST_FILES_BASE}`)
    if (response.ok) {
      const files = await response.json() as string[]
      return files
    }
  } catch (error) {
    console.warn('Failed to discover test files, using fallback list:', error)
  }
  return ['welcome.md', 'getting-started.md']
}

async function load_base_files(): Promise<Map<NotePath, { markdown: string; mtime_ms: number }>> {
  const notes = new Map<NotePath, { markdown: string; mtime_ms: number }>()
  const test_files = await discover_test_files()
  
  for (const file_name of test_files) {
    try {
      const response = await fetch(`${TEST_FILES_BASE}/${file_name}`, { cache: 'no-store' })
      if (response.ok) {
        const content = await response.text()
        const note_path = as_note_path(file_name)
        notes.set(note_path, {
          markdown: as_markdown_text(content),
          mtime_ms: Date.now()
        })
      }
    } catch (error) {
      console.warn(`Failed to load test file ${file_name}:`, error)
    }
  }
  
  return notes
}

export function create_test_notes_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId): Promise<NoteMeta[]> {
      const notes = await load_base_files()
      const result: NoteMeta[] = []

      for (const [note_path, data] of notes.entries()) {
        const parts = note_path.split('/').filter(Boolean)
        const last_part = parts[parts.length - 1] || ''
        const title = last_part.replace(/\.md$/, '')

        result.push({
          id: note_path,
          path: note_path,
          title,
          mtime_ms: data.mtime_ms,
          size_bytes: new Blob([data.markdown]).size
        })
      }

      return result.sort((a, b) => a.path.localeCompare(b.path))
    },

    async read_note(vault_id: VaultId, note_id: NoteId): Promise<NoteDoc> {
      const notes = await load_base_files()
      const note_path = as_note_path(note_id)
      const note_data = notes.get(note_path)

      if (!note_data) {
        throw new Error(`Note not found: ${note_id}`)
      }

      const parts = note_path.split('/').filter(Boolean)
      const last_part = parts[parts.length - 1] || ''
      const title = last_part.replace(/\.md$/, '')

      const meta: NoteMeta = {
        id: note_path,
        path: note_path,
        title,
        mtime_ms: note_data.mtime_ms,
        size_bytes: new Blob([note_data.markdown]).size
      }

      return { meta, markdown: as_markdown_text(note_data.markdown) }
    },

    async write_note(_vault_id: VaultId, _note_id: NoteId, _markdown: MarkdownText): Promise<void> {
    },

    async create_note(_vault_id: VaultId, note_path: NotePath, initial_markdown: MarkdownText): Promise<NoteMeta> {
      const full_path = note_path.endsWith('.md') ? as_note_path(note_path) : as_note_path(`${note_path}.md`)
      const parts = full_path.split('/').filter(Boolean)
      const last_part = parts[parts.length - 1] || ''
      const title = last_part.replace(/\.md$/, '')

      return {
        id: full_path,
        path: full_path,
        title,
        mtime_ms: Date.now(),
        size_bytes: new Blob([initial_markdown]).size
      }
    },

    async rename_note(_vault_id: VaultId, _from: NotePath, _to: NotePath): Promise<void> {
    },

    async delete_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {
    }
  }
}
