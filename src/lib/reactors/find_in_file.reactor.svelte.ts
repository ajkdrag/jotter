import type { UIStore } from "$lib/stores/ui_store.svelte";
import type { EditorService } from "$lib/services/editor_service";

export function create_find_in_file_reactor(
  ui_store: UIStore,
  editor_service: EditorService,
): () => void {
  return $effect.root(() => {
    $effect(() => {
      const { open, query, selected_match_index } = ui_store.find_in_file;

      if (!open || !query) {
        editor_service.update_find_state("", 0);
        return;
      }

      editor_service.update_find_state(query, selected_match_index);
    });
  });
}
