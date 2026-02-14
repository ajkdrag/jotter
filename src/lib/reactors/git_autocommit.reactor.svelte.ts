import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { GitStore } from "$lib/stores/git_store.svelte";
import type { GitService } from "$lib/services/git_service";

const AUTOCOMMIT_DELAY_MS = 30_000;

export function create_git_autocommit_reactor(
  editor_store: EditorStore,
  git_store: GitStore,
  git_service: GitService,
): () => void {
  return $effect.root(() => {
    let was_dirty = false;

    $effect(() => {
      if (!git_store.enabled) return;

      const open_note = editor_store.open_note;
      if (!open_note) {
        was_dirty = false;
        return;
      }

      const is_dirty = open_note.is_dirty;

      if (is_dirty) {
        was_dirty = true;
        return;
      }

      if (!was_dirty) return;
      was_dirty = false;

      if (!open_note.meta.path.endsWith(".md")) return;

      const saved_path = open_note.meta.path;

      const handle = setTimeout(() => {
        void git_service.auto_commit([saved_path]);
      }, AUTOCOMMIT_DELAY_MS);

      return () => {
        clearTimeout(handle);
      };
    });
  });
}
