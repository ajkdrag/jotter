import { apply_editor_styles } from "$lib/utils/apply_editor_styles";
import type { UIStore } from "$lib/stores/ui_store.svelte";

export function create_editor_styles_reactor(ui_store: UIStore): () => void {
  return $effect.root(() => {
    $effect(() => {
      apply_editor_styles(ui_store.editor_settings);
    });
  });
}
