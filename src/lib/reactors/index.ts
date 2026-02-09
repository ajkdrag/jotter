import { create_editor_sync_reactor } from "$lib/reactors/editor_sync.reactor.svelte";
import { create_editor_styles_reactor } from "$lib/reactors/editor_styles.reactor.svelte";
import { create_autosave_reactor } from "$lib/reactors/autosave.reactor.svelte";
import { create_op_toast_reactor } from "$lib/reactors/op_toast.reactor.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { UIStore } from "$lib/stores/ui_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { EditorService } from "$lib/services/editor_service";
import type { NoteService } from "$lib/services/note_service";

export type ReactorContext = {
  editor_store: EditorStore;
  ui_store: UIStore;
  op_store: OpStore;
  editor_service: EditorService;
  note_service: NoteService;
};

export function mount_reactors(context: ReactorContext): () => void {
  const unmounts = [
    create_editor_sync_reactor(
      context.editor_store,
      context.ui_store,
      context.editor_service,
    ),
    create_autosave_reactor(context.editor_store, context.note_service),
    create_editor_styles_reactor(context.ui_store),
    create_op_toast_reactor(context.op_store),
  ];

  return () => {
    for (const unmount of unmounts) {
      unmount();
    }
  };
}
