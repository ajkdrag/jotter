import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { TabStore } from "$lib/stores/tab_store.svelte";
import type { TabService } from "$lib/services/tab_service";

export function create_tab_dirty_sync_reactor(
  editor_store: EditorStore,
  tab_store: TabStore,
  tab_service: TabService,
): () => void {
  return $effect.root(() => {
    $effect(() => {
      const open_note = editor_store.open_note;
      const active_tab_id = tab_store.active_tab_id;
      if (!open_note || !active_tab_id) return;

      const is_dirty = open_note.is_dirty;
      tab_service.sync_dirty_state(active_tab_id, is_dirty);
    });
  });
}
