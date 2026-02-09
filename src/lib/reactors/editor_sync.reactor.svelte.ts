import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { UIStore } from "$lib/stores/ui_store.svelte";
import type { EditorService } from "$lib/services/editor_service";

export function create_editor_sync_reactor(
  editor_store: EditorStore,
  ui_store: UIStore,
  editor_service: EditorService,
): () => void {
  let last_note_id: string | null = null;
  let last_link_syntax: "wikilink" | "markdown" =
    ui_store.editor_settings.link_syntax;

  return $effect.root(() => {
    $effect(() => {
      const open_note = editor_store.open_note;
      const link_syntax = ui_store.editor_settings.link_syntax;

      if (!open_note) {
        last_note_id = null;
        last_link_syntax = link_syntax;
        return;
      }

      if (!editor_service.is_mounted()) {
        return;
      }

      const should_open =
        open_note.meta.id !== last_note_id || link_syntax !== last_link_syntax;

      last_note_id = open_note.meta.id;
      last_link_syntax = link_syntax;

      if (!should_open) return;
      void editor_service.open_buffer(open_note, link_syntax);
    });
  });
}
