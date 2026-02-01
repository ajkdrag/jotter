import type { NotesPort } from '$lib/ports/notes_port'
import { as_markdown_text, as_note_path, type MarkdownText, type NoteId, type NotePath, type VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'
import type { FolderContents } from '$lib/types/filetree'

const TEST_FILES_BASE = '/test/files'
const TEST_FILES_INDEX = '/test/files/index.json'

const FALLBACK_TEST_NOTES = new Map<NotePath, { markdown: string; mtime_ms: number }>([
  [as_note_path('welcome.md'), { markdown: as_markdown_text('# Welcome\n\nWelcome to your notes.'), mtime_ms: Date.now() }],
  [as_note_path('getting-started.md'), { markdown: as_markdown_text('# Getting Started\n\nStart taking notes!'), mtime_ms: Date.now() }]
])

async function discover_test_files(): Promise<string[]> {
  if (typeof fetch === 'undefined') {
    return ['welcome.md', 'getting-started.md']
  }

  try {
    const response = await fetch(TEST_FILES_INDEX)
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
  if (typeof fetch === 'undefined') {
    return new Map(FALLBACK_TEST_NOTES)
  }

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

  if (notes.size === 0) {
    return new Map(FALLBACK_TEST_NOTES)
  }

  return notes
}

export function create_test_notes_adapter(): NotesPort {
  const created_folders = new Set<string>()

  return {
    async list_notes(_vault_id: VaultId): Promise<NoteMeta[]> {
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

    async list_folders(_vault_id: VaultId): Promise<string[]> {
      const notes = await load_base_files()
      const dirs = new Set<string>()
      for (const note_path of notes.keys()) {
        const parts = note_path.split('/').filter(Boolean)
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join('/'))
        }
      }
      for (const folder of created_folders) {
        dirs.add(folder)
      }
      return Array.from(dirs).sort((a, b) => a.localeCompare(b))
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

    async create_folder(_vault_id: VaultId, parent_path: string, folder_name: string): Promise<void> {
      const full_path = parent_path ? `${parent_path}/${folder_name}` : folder_name
      created_folders.add(full_path)
    },

    async rename_note(_vault_id: VaultId, _from: NotePath, _to: NotePath): Promise<void> {
    },

    async delete_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {
    },

    async list_folder_contents(_vault_id: VaultId, folder_path: string): Promise<FolderContents> {
      const notes = await load_base_files()
      const result_notes: NoteMeta[] = []
      const subfolders = new Set<string>()

      const prefix = folder_path ? folder_path + '/' : ''

      for (const [note_path, data] of notes.entries()) {
        if (!note_path.startsWith(prefix) && prefix !== '') continue

        const remaining = prefix ? note_path.slice(prefix.length) : note_path
        const slash_index = remaining.indexOf('/')

        if (slash_index === -1) {
          const parts = note_path.split('/').filter(Boolean)
          const last_part = parts[parts.length - 1] || ''
          const title = last_part.replace(/\.md$/, '')

          result_notes.push({
            id: note_path,
            path: note_path,
            title,
            mtime_ms: data.mtime_ms,
            size_bytes: new Blob([data.markdown]).size
          })
        } else {
          const subfolder_name = remaining.slice(0, slash_index)
          const subfolder_path = folder_path ? `${folder_path}/${subfolder_name}` : subfolder_name
          subfolders.add(subfolder_path)
        }
      }

      for (const folder of created_folders) {
        const is_direct_child = folder_path
          ? folder.startsWith(folder_path + '/') && !folder.slice(folder_path.length + 1).includes('/')
          : !folder.includes('/')

        if (is_direct_child) {
          subfolders.add(folder)
        }
      }

      return {
        notes: result_notes.sort((a, b) => a.path.localeCompare(b.path)),
        subfolders: Array.from(subfolders).sort((a, b) => a.localeCompare(b))
      }
    }
  }
}
