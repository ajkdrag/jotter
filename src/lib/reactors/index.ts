import { create_editor_sync_reactor } from '$lib/reactors/editor_sync.reactor.svelte'
import { create_editor_styles_reactor } from '$lib/reactors/editor_styles.reactor.svelte'
import { create_editor_internal_link_reactor } from '$lib/reactors/editor_internal_link.reactor.svelte'
import { create_editor_image_paste_reactor } from '$lib/reactors/editor_image_paste.reactor.svelte'
import { create_op_toast_reactor } from '$lib/reactors/op_toast.reactor.svelte'
import type { ActionRegistry } from '$lib/actions/registry'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { EditorService } from '$lib/services/editor_service'

export type ReactorContext = {
  editor_store: EditorStore
  ui_store: UIStore
  op_store: OpStore
  editor_service: EditorService
  action_registry: ActionRegistry
}

export function mount_reactors(context: ReactorContext): () => void {
  const unmounts = [
    create_editor_sync_reactor(context.editor_store, context.ui_store, context.editor_service),
    create_editor_internal_link_reactor(context.editor_store, context.action_registry),
    create_editor_image_paste_reactor(context.editor_store, context.action_registry),
    create_editor_styles_reactor(context.ui_store),
    create_op_toast_reactor(context.op_store)
  ]

  return () => {
    for (const unmount of unmounts) {
      unmount()
    }
  }
}
