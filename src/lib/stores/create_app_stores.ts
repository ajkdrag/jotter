import { create_vault_store, type VaultStore } from './vault_store'
import { create_notes_store, type NotesStore } from './notes_store'
import { create_editor_store, type EditorStore } from './editor_store'
import { create_ui_store, type UIStore } from './ui_store'

export type AppStores = {
  vault: VaultStore
  notes: NotesStore
  editor: EditorStore
  ui: UIStore
  now_ms: () => number // why handle differently?
}

export type CreateAppStoresInput = {
  now_ms?: () => number
}

export function create_app_stores(input: CreateAppStoresInput = {}): AppStores {
  return {
    vault: create_vault_store(),
    notes: create_notes_store(),
    editor: create_editor_store(),
    ui: create_ui_store(),
    now_ms: input.now_ms ?? (() => Date.now())
  }
}
