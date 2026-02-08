import type { VaultPort } from '$lib/ports/vault_port'
import type { NotesPort, FolderStats } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId, VaultPath, NotePath, NoteId, MarkdownText } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { FolderContents } from '$lib/types/filetree'

export function create_mock_vault_port(): VaultPort & {
  _calls: { choose_vault: number; open_vault: VaultPath[]; open_vault_by_id: VaultId[] }
  _mock_vaults: Vault[]
} {
  const mock = {
    _calls: {
      choose_vault: 0,
      open_vault: [] as VaultPath[],
      open_vault_by_id: [] as VaultId[]
    },
    _mock_vaults: [] as Vault[],
    choose_vault() {
      mock._calls.choose_vault++
      return Promise.resolve(null)
    },
    open_vault(vault_path: VaultPath) {
      mock._calls.open_vault.push(vault_path)
      const vault = mock._mock_vaults.find((v) => v.path === vault_path)
      if (!vault) return Promise.reject(new Error(`Vault not found: ${vault_path}`))
      return Promise.resolve(vault)
    },
    open_vault_by_id(vault_id: VaultId) {
      mock._calls.open_vault_by_id.push(vault_id)
      const vault = mock._mock_vaults.find((v) => v.id === vault_id)
      if (!vault) return Promise.reject(new Error(`Vault not found: ${vault_id}`))
      return Promise.resolve(vault)
    },
    list_vaults() {
      return Promise.resolve(mock._mock_vaults)
    },
    remember_last_vault(_vault_id: VaultId) {
      return Promise.resolve()
    },
    get_last_vault_id() {
      return Promise.resolve(null)
    }
  }
  return mock
}

export function create_mock_notes_port(): NotesPort & {
  _mock_notes: Map<VaultId, NoteMeta[]>
  _mock_folders: Map<VaultId, string[]>
  _calls: {
    delete_note: { vault_id: VaultId; note_id: NoteId }[]
    rename_note: { vault_id: VaultId; from: NotePath; to: NotePath }[]
    write_note: { vault_id: VaultId; note_id: NoteId; markdown: MarkdownText }[]
    create_note: { vault_id: VaultId; note_path: NotePath; markdown: MarkdownText }[]
    create_folder: { vault_id: VaultId; parent_path: string; folder_name: string }[]
    rename_folder: { vault_id: VaultId; from_path: string; to_path: string }[]
    delete_folder: { vault_id: VaultId; folder_path: string }[]
    get_folder_stats: { vault_id: VaultId; folder_path: string }[]
  }
} {
  const mock = {
    _mock_notes: new Map<VaultId, NoteMeta[]>(),
    _mock_folders: new Map<VaultId, string[]>(),
    _calls: {
      delete_note: [] as { vault_id: VaultId; note_id: NoteId }[],
      rename_note: [] as { vault_id: VaultId; from: NotePath; to: NotePath }[],
      write_note: [] as { vault_id: VaultId; note_id: NoteId; markdown: MarkdownText }[],
      create_note: [] as { vault_id: VaultId; note_path: NotePath; markdown: MarkdownText }[],
      create_folder: [] as { vault_id: VaultId; parent_path: string; folder_name: string }[],
      rename_folder: [] as { vault_id: VaultId; from_path: string; to_path: string }[],
      delete_folder: [] as { vault_id: VaultId; folder_path: string }[],
      get_folder_stats: [] as { vault_id: VaultId; folder_path: string }[]
    },
    list_notes(vault_id: VaultId) {
      return Promise.resolve(mock._mock_notes.get(vault_id) || [])
    },
    list_folders(vault_id: VaultId) {
      return Promise.resolve(mock._mock_folders.get(vault_id) || [])
    },
    read_note(_vault_id: VaultId, _note_id: NoteId) {
      return Promise.resolve({
        meta: { id: _note_id, path: _note_id, title: '', mtime_ms: 0, size_bytes: 0 },
        markdown: '' as MarkdownText
      })
    },
    write_note(vault_id: VaultId, note_id: NoteId, markdown: MarkdownText) {
      mock._calls.write_note.push({ vault_id, note_id, markdown })
      return Promise.resolve()
    },
    create_note(vault_id: VaultId, note_path: NotePath, markdown: MarkdownText) {
      mock._calls.create_note.push({ vault_id, note_path, markdown })
      const new_note = {
        id: note_path,
        path: note_path,
        title: note_path.replace('.md', ''),
        mtime_ms: Date.now(),
        size_bytes: markdown.length
      }
      const current = mock._mock_notes.get(vault_id) || []
      mock._mock_notes.set(vault_id, [...current, new_note])
      return Promise.resolve(new_note)
    },
    delete_note(vault_id: VaultId, note_id: NoteId) {
      mock._calls.delete_note.push({ vault_id, note_id })
      const current = mock._mock_notes.get(vault_id) || []
      mock._mock_notes.set(
        vault_id,
        current.filter((note) => note.id !== note_id)
      )
      return Promise.resolve()
    },
    rename_note(vault_id: VaultId, old_path: NotePath, new_path: NotePath): Promise<void> {
      mock._calls.rename_note.push({ vault_id, from: old_path, to: new_path })
      const current = mock._mock_notes.get(vault_id) || []
      const updated = current.map((note) =>
        note.path === old_path ? { ...note, path: new_path, id: new_path } : note
      )
      mock._mock_notes.set(vault_id, updated)
      return Promise.resolve()
    },
    create_folder(vault_id: VaultId, parent_path: string, folder_name: string): Promise<void> {
      mock._calls.create_folder.push({ vault_id, parent_path, folder_name })
      const full_path = parent_path ? `${parent_path}/${folder_name}` : folder_name
      const current = mock._mock_folders.get(vault_id) || []
      if (!current.includes(full_path)) {
        mock._mock_folders.set(vault_id, [...current, full_path].sort((a, b) => a.localeCompare(b)))
      }
      return Promise.resolve()
    },
    list_folder_contents(
      vault_id: VaultId,
      folder_path: string,
      offset: number,
      limit: number
    ): Promise<FolderContents> {
      const all_notes = mock._mock_notes.get(vault_id) || []
      const all_folders = mock._mock_folders.get(vault_id) || []
      const prefix = folder_path ? folder_path + '/' : ''

      const notes = all_notes.filter((note) => {
        if (!note.path.startsWith(prefix) && prefix !== '') return false
        const remaining = prefix ? note.path.slice(prefix.length) : note.path
        return !remaining.includes('/')
      })

      const subfolders = all_folders.filter((folder) => {
        if (!folder.startsWith(prefix) && prefix !== '') return false
        const remaining = prefix ? folder.slice(prefix.length) : folder
        return !remaining.includes('/')
      })

      const sorted_notes = [...notes].sort((a, b) => a.path.localeCompare(b.path))
      const sorted_folders = [...subfolders].sort((a, b) => a.localeCompare(b))
      const combined = [
        ...sorted_folders.map((path) => ({ kind: 'folder' as const, path })),
        ...sorted_notes.map((note) => ({ kind: 'note' as const, note }))
      ]

      const total_count = combined.length
      const start = Math.min(offset, total_count)
      const end = Math.min(start + Math.max(limit, 0), total_count)
      const page = combined.slice(start, end)

      const paged_notes: NoteMeta[] = []
      const paged_subfolders: string[] = []
      for (const entry of page) {
        if (entry.kind === 'folder') {
          paged_subfolders.push(entry.path)
        } else {
          paged_notes.push(entry.note)
        }
      }

      return Promise.resolve({
        notes: paged_notes,
        subfolders: paged_subfolders,
        total_count,
        has_more: end < total_count
      })
    },
    rename_folder(vault_id: VaultId, from_path: string, to_path: string) {
      mock._calls.rename_folder.push({ vault_id, from_path, to_path })
      const current = mock._mock_folders.get(vault_id) || []
      const updated = current.map((path) => (path === from_path ? to_path : path))
      mock._mock_folders.set(vault_id, updated)
      return Promise.resolve()
    },
    delete_folder(vault_id: VaultId, folder_path: string) {
      mock._calls.delete_folder.push({ vault_id, folder_path })
      const prefix = folder_path + '/'
      const current_folders = mock._mock_folders.get(vault_id) || []
      const updated_folders = current_folders.filter(
        (path) => path !== folder_path && !path.startsWith(prefix)
      )
      mock._mock_folders.set(vault_id, updated_folders)
      return Promise.resolve({ deleted_notes: [], deleted_folders: [] })
    },
    get_folder_stats(vault_id: VaultId, folder_path: string): Promise<FolderStats> {
      mock._calls.get_folder_stats.push({ vault_id, folder_path })
      return Promise.resolve({ note_count: 0, folder_count: 0 })
    }
  }
  return mock
}

export function create_mock_index_port(): WorkspaceIndexPort & {
  _calls: { build_index: VaultId[]; upsert_note: { vault_id: VaultId; note_id: NoteId }[]; remove_note: { vault_id: VaultId; note_id: NoteId }[] }
} {
  const mock = {
    _calls: {
      build_index: [] as VaultId[],
      upsert_note: [] as { vault_id: VaultId; note_id: NoteId }[],
      remove_note: [] as { vault_id: VaultId; note_id: NoteId }[]
    },
    build_index(vault_id: VaultId) {
      mock._calls.build_index.push(vault_id)
      return Promise.resolve()
    },
    upsert_note(vault_id: VaultId, note_id: NoteId) {
      mock._calls.upsert_note.push({ vault_id, note_id })
      return Promise.resolve()
    },
    remove_note(vault_id: VaultId, note_id: NoteId) {
      mock._calls.remove_note.push({ vault_id, note_id })
      return Promise.resolve()
    }
  }
  return mock
}

export function create_mock_ports() {
  return {
    vault: create_mock_vault_port(),
    notes: create_mock_notes_port(),
    index: create_mock_index_port()
  }
}
