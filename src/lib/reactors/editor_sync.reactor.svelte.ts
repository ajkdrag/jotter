import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { EditorService } from "$lib/services/editor_service";

export function resolve_editor_sync_open(input: {
  open_note_id: string;
  open_note_buffer_id: string;
  last_note_id: string | null;
  last_buffer_id: string | null;
}): boolean {
  return (
    input.open_note_id !== input.last_note_id ||
    input.open_note_buffer_id !== input.last_buffer_id
  );
}

export function create_editor_sync_reactor(
  editor_store: EditorStore,
  editor_service: EditorService,
): () => void {
  let last_note_id: string | null = null;
  let last_buffer_id: string | null = null;

  return $effect.root(() => {
    $effect(() => {
      const open_note = editor_store.open_note;

      if (!open_note) {
        last_note_id = null;
        last_buffer_id = null;
        return;
      }

      if (!editor_service.is_mounted()) {
        last_note_id = open_note.meta.id;
        last_buffer_id = open_note.buffer_id;
        return;
      }

      const should_open = resolve_editor_sync_open({
        open_note_id: open_note.meta.id,
        open_note_buffer_id: open_note.buffer_id,
        last_note_id,
        last_buffer_id,
      });

      last_note_id = open_note.meta.id;
      last_buffer_id = open_note.buffer_id;

      if (!should_open) return;
      editor_service.open_buffer(open_note);
    });
  });
}
