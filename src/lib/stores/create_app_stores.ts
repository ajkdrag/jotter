import { create_vault_store, type VaultStore } from './vault_store'
import { create_notes_store, type NotesStore } from './notes_store'
import { create_editor_store, type EditorStore } from './editor_store'
import { create_ui_store, type UIStore } from './ui_store'
import type { AppEvent } from '$lib/events/app_event'

export type AppStores = {
  vault: VaultStore
  notes: NotesStore
  editor: EditorStore
  ui: UIStore
  dispatch: (event: AppEvent) => void
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

export type CreateAppStoresInput = {
  now_ms?: () => number
}

export function create_app_stores(input: CreateAppStoresInput = {}): AppStores {
  const vault = create_vault_store()
  const notes = create_notes_store()
  const editor = create_editor_store()
  const ui = create_ui_store()

  const dispatch = (event: AppEvent) => {
    vault.reduce(event)
    notes.reduce(event)
    editor.reduce(event)
    ui.reduce(event)
  }

  const dispatch_many = (events: AppEvent[]) => {
    for (const event of events) {
      dispatch(event)
    }
  }

  return {
    vault,
    notes,
    editor,
    ui,
    dispatch,
    dispatch_many,
    now_ms: input.now_ms ?? (() => Date.now())
  }
}
