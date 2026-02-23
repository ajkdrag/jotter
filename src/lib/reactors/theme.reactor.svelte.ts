import { apply_theme } from "$lib/utils/apply_theme";
import type { UIStore } from "$lib/stores/ui_store.svelte";

export function create_theme_reactor(ui_store: UIStore): () => void {
  return $effect.root(() => {
    $effect(() => {
      apply_theme(ui_store.active_theme);
    });
  });
}
