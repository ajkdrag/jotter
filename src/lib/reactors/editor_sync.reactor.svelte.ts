import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { UIStore } from "$lib/stores/ui_store.svelte";
import type { EditorService } from "$lib/services/editor_service";
import type { OpenNoteState } from "$lib/types/editor";
import type { EditorSettings } from "$lib/types/editor_settings";

export function resolve_editor_sync_open(input: {
  open_note: OpenNoteState;
  link_syntax: EditorSettings["link_syntax"];
  last_note_id: string | null;
  last_buffer_id: string | null;
  last_link_syntax: EditorSettings["link_syntax"];
}): boolean {
  return (
    input.open_note.meta.id !== input.last_note_id ||
    input.open_note.buffer_id !== input.last_buffer_id ||
    input.link_syntax !== input.last_link_syntax
  );
}

export function create_editor_sync_reactor(
  editor_store: EditorStore,
  ui_store: UIStore,
  editor_service: EditorService,
): () => void {
  let last_note_id: string | null = null;
  let last_buffer_id: string | null = null;
  let last_link_syntax: "wikilink" | "markdown" =
    ui_store.editor_settings.link_syntax;

  return $effect.root(() => {
    $effect(() => {
      const open_note = editor_store.open_note;
      const link_syntax = ui_store.editor_settings.link_syntax;

      if (!open_note) {
        last_note_id = null;
        last_buffer_id = null;
        last_link_syntax = link_syntax;
        return;
      }

      if (!editor_service.is_mounted()) {
        last_note_id = open_note.meta.id;
        last_buffer_id = open_note.buffer_id;
        last_link_syntax = link_syntax;
        return;
      }

      const should_open = resolve_editor_sync_open({
        open_note,
        link_syntax,
        last_note_id,
        last_buffer_id,
        last_link_syntax,
      });

      last_note_id = open_note.meta.id;
      last_buffer_id = open_note.buffer_id;
      last_link_syntax = link_syntax;

      if (!should_open) return;
      editor_service.open_buffer(open_note, link_syntax);
    });
  });
}
