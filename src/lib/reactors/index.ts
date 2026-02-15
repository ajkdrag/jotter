import { create_editor_sync_reactor } from "$lib/reactors/editor_sync.reactor.svelte";
import { create_editor_styles_reactor } from "$lib/reactors/editor_styles.reactor.svelte";
import { create_autosave_reactor } from "$lib/reactors/autosave.reactor.svelte";
import { create_op_toast_reactor } from "$lib/reactors/op_toast.reactor.svelte";
import { create_recent_notes_persist_reactor } from "$lib/reactors/recent_notes_persist.reactor.svelte";
import { create_starred_persist_reactor } from "$lib/reactors/starred_persist.reactor.svelte";
import { create_tab_dirty_sync_reactor } from "$lib/reactors/tab_dirty_sync.reactor.svelte";
import { create_tab_persist_reactor } from "$lib/reactors/tab_persist.reactor.svelte";
import { create_git_autocommit_reactor } from "$lib/reactors/git_autocommit.reactor.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { UIStore } from "$lib/stores/ui_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { TabStore } from "$lib/stores/tab_store.svelte";
import type { EditorService } from "$lib/services/editor_service";
import type { NoteService } from "$lib/services/note_service";
import type { VaultService } from "$lib/services/vault_service";
import type { TabService } from "$lib/services/tab_service";
import type { GitStore } from "$lib/stores/git_store.svelte";
import type { GitService } from "$lib/services/git_service";

export type ReactorContext = {
  editor_store: EditorStore;
  ui_store: UIStore;
  op_store: OpStore;
  notes_store: NotesStore;
  vault_store: VaultStore;
  tab_store: TabStore;
  git_store: GitStore;
  editor_service: EditorService;
  note_service: NoteService;
  vault_service: VaultService;
  tab_service: TabService;
  git_service: GitService;
};

export function mount_reactors(context: ReactorContext): () => void {
  const unmounts = [
    create_editor_sync_reactor(
      context.editor_store,
      context.ui_store,
      context.editor_service,
    ),
    create_autosave_reactor(
      context.editor_store,
      context.ui_store,
      context.note_service,
    ),
    create_editor_styles_reactor(context.ui_store),
    create_op_toast_reactor(context.op_store),
    create_recent_notes_persist_reactor(
      context.notes_store,
      context.vault_store,
      context.vault_service,
    ),
    create_starred_persist_reactor(
      context.notes_store,
      context.vault_store,
      context.vault_service,
    ),
    create_tab_dirty_sync_reactor(
      context.editor_store,
      context.tab_store,
      context.tab_service,
    ),
    create_tab_persist_reactor(
      context.tab_store,
      context.vault_store,
      context.tab_service,
    ),
    create_git_autocommit_reactor(
      context.editor_store,
      context.git_store,
      context.ui_store,
      context.git_service,
    ),
  ];

  return () => {
    for (const unmount of unmounts) {
      unmount();
    }
  };
}
