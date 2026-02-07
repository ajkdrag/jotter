import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistry } from '$lib/actions/registry'
import type { EditorStore } from '$lib/stores/editor_store.svelte'

export function create_editor_internal_link_reactor(
  editor_store: EditorStore,
  action_registry: ActionRegistry
): () => void {
  let last_handled_event_id = 0

  return $effect.root(() => {
    $effect(() => {
      const click = editor_store.internal_link_click
      if (!click) return
      if (click.event_id === last_handled_event_id) return

      last_handled_event_id = click.event_id
      void action_registry.execute(ACTION_IDS.note_open_wiki_link, click.note_path)
    })
  })
}
