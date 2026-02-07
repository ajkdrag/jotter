import { VaultStore } from '$lib/stores/vault_store.svelte'
import { NotesStore } from '$lib/stores/notes_store.svelte'
import { EditorStore } from '$lib/stores/editor_store.svelte'
import { UIStore } from '$lib/stores/ui_store.svelte'
import { OpStore } from '$lib/stores/op_store.svelte'

export type AppStores = {
  vault: VaultStore
  notes: NotesStore
  editor: EditorStore
  ui: UIStore
  op: OpStore
}

export function create_app_stores(): AppStores {
  return {
    vault: new VaultStore(),
    notes: new NotesStore(),
    editor: new EditorStore(),
    ui: new UIStore(),
    op: new OpStore()
  }
}
