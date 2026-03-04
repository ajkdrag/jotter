import type { WorkspaceIndexPort } from "$lib/features/search";

export function create_test_workspace_index_adapter(): WorkspaceIndexPort {
  return {
    cancel_index: () => Promise.resolve(),
    sync_index: () => Promise.resolve(),
    rebuild_index: () => Promise.resolve(),
    list_note_paths_by_prefix: () => Promise.resolve([]),
    upsert_note: () => Promise.resolve(),
    remove_note: () => Promise.resolve(),
    remove_notes: () => Promise.resolve(),
    rename_note_path: () => Promise.resolve(),
    remove_notes_by_prefix: () => Promise.resolve(),
    rename_folder_paths: () => Promise.resolve(),
    subscribe_index_progress: () => () => {},
  };
}
