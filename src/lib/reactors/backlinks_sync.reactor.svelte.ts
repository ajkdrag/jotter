import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { UIStore } from "$lib/stores/ui_store.svelte";
import type { SearchStore } from "$lib/stores/search_store.svelte";
import type { LinksService } from "$lib/services/links_service";

type BacklinksSyncState = {
  last_note_path: string | null;
  last_panel_open: boolean;
  last_index_status: SearchStore["index_progress"]["status"];
  last_is_dirty: boolean;
};

type BacklinksSyncInput = {
  open_note_path: string | null;
  panel_open: boolean;
  index_status: SearchStore["index_progress"]["status"];
  is_dirty: boolean;
};

type BacklinksSyncDecision = {
  action: "clear" | "load" | "noop";
  note_path: string | null;
  next_state: BacklinksSyncState;
};

export function resolve_backlinks_sync_decision(
  state: BacklinksSyncState,
  input: BacklinksSyncInput,
): BacklinksSyncDecision {
  const next_state: BacklinksSyncState = {
    last_note_path: input.open_note_path,
    last_panel_open: input.panel_open,
    last_index_status: input.index_status,
    last_is_dirty: input.is_dirty,
  };

  if (!input.open_note_path) {
    return { action: "clear", note_path: null, next_state };
  }

  const path_changed = input.open_note_path !== state.last_note_path;
  const panel_opened = input.panel_open && !state.last_panel_open;
  const index_completed =
    input.index_status === "completed" &&
    state.last_index_status !== "completed";
  const save_completed =
    !input.is_dirty &&
    state.last_is_dirty &&
    input.open_note_path === state.last_note_path;

  const should_load =
    input.panel_open &&
    (path_changed || panel_opened || index_completed || save_completed);

  return {
    action: should_load ? "load" : "noop",
    note_path: input.open_note_path,
    next_state,
  };
}

export function create_backlinks_sync_reactor(
  editor_store: EditorStore,
  ui_store: UIStore,
  search_store: SearchStore,
  links_service: LinksService,
): () => void {
  let state: BacklinksSyncState = {
    last_note_path: null,
    last_panel_open: false,
    last_index_status: "idle",
    last_is_dirty: false,
  };

  return $effect.root(() => {
    $effect(() => {
      const decision = resolve_backlinks_sync_decision(state, {
        open_note_path: editor_store.open_note?.meta.path ?? null,
        panel_open: ui_store.context_rail_open,
        index_status: search_store.index_progress.status,
        is_dirty: editor_store.open_note?.is_dirty ?? false,
      });
      state = decision.next_state;

      if (decision.action === "clear") {
        links_service.clear();
        return;
      }
      if (decision.action === "load" && decision.note_path) {
        void links_service.load_note_links(decision.note_path);
      }
    });
  });
}
