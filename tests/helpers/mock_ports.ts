import type { VaultPort } from '$lib/ports/vault_port'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId, VaultPath, NotePath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'

export function create_mock_vault_port(): VaultPort & {
  _calls: { choose_vault: number; open_vault: any[]; open_vault_by_id: any[] }
  _mock_vaults: Vault[]
} {
  const mock = {
    _calls: {
      choose_vault: 0,
      open_vault: [] as any[],
      open_vault_by_id: [] as any[]
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
  _calls: { delete_note: { vault_id: VaultId; note_id: any }[] }
} {
  const mock = {
    _mock_notes: new Map<VaultId, NoteMeta[]>(),
    _calls: {
      delete_note: [] as { vault_id: VaultId; note_id: any }[]
    },
    async list_notes(vault_id: VaultId) {
      return mock._mock_notes.get(vault_id) || []
    },
    async read_note(_vault_id: VaultId, _note_id: any) {
      return {
        meta: { id: _note_id, path: _note_id, title: '', mtime_ms: 0, size_bytes: 0 },
        markdown: '' as any
      }
    },
    async write_note(_vault_id: VaultId, _note_id: any, _markdown: any) {},
    async create_note(_vault_id: VaultId, _note_path: NotePath, _markdown: any) {
      return { id: _note_path as any, path: _note_path, title: '', mtime_ms: 0, size_bytes: 0 }
    },
    async delete_note(vault_id: VaultId, note_id: any) {
      mock._calls.delete_note.push({ vault_id, note_id })
      const current = mock._mock_notes.get(vault_id) || []
      mock._mock_notes.set(
        vault_id,
        current.filter((note) => note.id !== note_id)
      )
    },
    async rename_note(_vault_id: VaultId, _old_path: NotePath, _new_path: NotePath): Promise<void> {}
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
