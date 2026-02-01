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
    async choose_vault() {
      mock._calls.choose_vault++
      return null
    },
    async open_vault(vault_path: VaultPath) {
      mock._calls.open_vault.push(vault_path)
      const vault = mock._mock_vaults.find((v) => v.path === vault_path)
      if (!vault) throw new Error(`Vault not found: ${vault_path}`)
      return vault
    },
    async open_vault_by_id(vault_id: VaultId) {
      mock._calls.open_vault_by_id.push(vault_id)
      const vault = mock._mock_vaults.find((v) => v.id === vault_id)
      if (!vault) throw new Error(`Vault not found: ${vault_id}`)
      return vault
    },
    async list_vaults() {
      return mock._mock_vaults
    },
    async remember_last_vault(_vault_id: VaultId) {},
    async get_last_vault_id() {
      return null
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
      create_folder: [] as { vault_id: VaultId; parent_path: string; folder_name: string }[]
    },
    async list_notes(vault_id: VaultId) {
      return mock._mock_notes.get(vault_id) || []
    },
    async list_folders(vault_id: VaultId) {
      return mock._mock_folders.get(vault_id) || []
    },
    async read_note(_vault_id: VaultId, _note_id: NoteId) {
      return {
        meta: { id: _note_id, path: _note_id, title: '', mtime_ms: 0, size_bytes: 0 },
        markdown: '' as MarkdownText
      }
    },
    async write_note(vault_id: VaultId, note_id: NoteId, markdown: MarkdownText) {
      mock._calls.write_note.push({ vault_id, note_id, markdown })
    },
    async create_note(vault_id: VaultId, note_path: NotePath, markdown: MarkdownText) {
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
      return new_note
    },
    async delete_note(vault_id: VaultId, note_id: NoteId) {
      mock._calls.delete_note.push({ vault_id, note_id })
      const current = mock._mock_notes.get(vault_id) || []
      mock._mock_notes.set(
        vault_id,
        current.filter((note) => note.id !== note_id)
      )
    },
    async rename_note(vault_id: VaultId, old_path: NotePath, new_path: NotePath): Promise<void> {
      mock._calls.rename_note.push({ vault_id, from: old_path, to: new_path })
      const current = mock._mock_notes.get(vault_id) || []
      const updated = current.map((note) =>
        note.path === old_path ? { ...note, path: new_path, id: new_path } : note
      )
      mock._mock_notes.set(vault_id, updated)
    },
    async create_folder(vault_id: VaultId, parent_path: string, folder_name: string): Promise<void> {
      mock._calls.create_folder.push({ vault_id, parent_path, folder_name })
      const full_path = parent_path ? `${parent_path}/${folder_name}` : folder_name
      const current = mock._mock_folders.get(vault_id) || []
      if (!current.includes(full_path)) {
        mock._mock_folders.set(vault_id, [...current, full_path].sort((a, b) => a.localeCompare(b)))
      }
    },
    async list_folder_contents(vault_id: VaultId, folder_path: string): Promise<FolderContents> {
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

      return { notes, subfolders }
    },
    async rename_folder(_vault_id: VaultId, from_path: string, to_path: string) {
      mock._calls.rename_note.push({ vault_id: _vault_id, from: from_path as NotePath, to: to_path as NotePath })
    },
    async delete_folder(_vault_id: VaultId, folder_path: string) {
      mock._calls.delete_note.push({ vault_id: _vault_id, note_id: folder_path as NotePath })
      return { deleted_notes: [], deleted_folders: [] }
    },
    async get_folder_stats(_vault_id: VaultId, _folder_path: string): Promise<FolderStats> {
      return { note_count: 0, folder_count: 0 }
    }
  }
  return mock
}

export function create_mock_index_port(): WorkspaceIndexPort & {
  _calls: { build_index: VaultId[] }
} {
  const mock = {
    _calls: {
      build_index: [] as VaultId[]
    },
    async build_index(vault_id: VaultId) {
      mock._calls.build_index.push(vault_id)
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
