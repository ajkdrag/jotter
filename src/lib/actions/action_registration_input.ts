import type { ActionRegistry } from '$lib/actions/registry'
import type { AppMountConfig } from '$lib/services/vault_service'
import type { VaultService } from '$lib/services/vault_service'
import type { NoteService } from '$lib/services/note_service'
import type { FolderService } from '$lib/services/folder_service'
import type { SettingsService } from '$lib/services/settings_service'
import type { SearchService } from '$lib/services/search_service'
import type { EditorService } from '$lib/services/editor_service'
import type { ClipboardService } from '$lib/services/clipboard_service'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { NotesStore } from '$lib/stores/notes_store.svelte'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'

export type ActionRegistrationInput = {
  registry: ActionRegistry
  stores: {
    ui: UIStore
    vault: VaultStore
    notes: NotesStore
    editor: EditorStore
    op: OpStore
  }
  services: {
    vault: VaultService
    note: NoteService
    folder: FolderService
    settings: SettingsService
    search: SearchService
    editor: EditorService
    clipboard: ClipboardService
  }
  default_mount_config: AppMountConfig
}
