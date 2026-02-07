import { create_editor_sync_reactor } from '$lib/reactors/editor_sync.reactor.svelte'
import { create_editor_styles_reactor } from '$lib/reactors/editor_styles.reactor.svelte'
import { create_filetree_vault_reactor } from '$lib/reactors/filetree_vault.reactor.svelte'
import { create_op_toast_reactor } from '$lib/reactors/op_toast.reactor.svelte'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { EditorService } from '$lib/services/editor_service'
import type { FolderService } from '$lib/services/folder_service'

export type ReactorContext = {
  editor_store: EditorStore
  ui_store: UIStore
  vault_store: VaultStore
  op_store: OpStore
  editor_service: EditorService
  folder_service: FolderService
}

export function mount_reactors(context: ReactorContext): () => void {
  const unmounts = [
    create_editor_sync_reactor(context.editor_store, context.ui_store, context.editor_service),
    create_editor_styles_reactor(context.ui_store),
    create_filetree_vault_reactor(context.vault_store, context.folder_service),
    create_op_toast_reactor(context.op_store)
  ]

  return () => {
    for (const unmount of unmounts) {
      unmount()
    }
  }
}
