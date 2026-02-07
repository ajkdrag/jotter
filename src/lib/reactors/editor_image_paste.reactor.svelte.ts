import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistry } from '$lib/actions/registry'
import type { EditorStore } from '$lib/stores/editor_store.svelte'

export function create_editor_image_paste_reactor(
  editor_store: EditorStore,
  action_registry: ActionRegistry
): () => void {
  let last_handled_event_id = 0

  return $effect.root(() => {
    $effect(() => {
      const request = editor_store.image_paste_request
      if (!request) return
      if (request.event_id === last_handled_event_id) return

      last_handled_event_id = request.event_id
      void action_registry.execute(ACTION_IDS.note_insert_pasted_image, request)
    })
  })
}
