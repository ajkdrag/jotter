import { apply_theme } from "$lib/shared/utils/apply_theme";
import type { UIStore } from "$lib/app";

export function create_theme_reactor(ui_store: UIStore): () => void {
  return $effect.root(() => {
    $effect(() => {
      apply_theme(ui_store.active_theme);
    });
  });
}
