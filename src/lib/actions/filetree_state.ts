import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type {
  FolderLoadState,
  FolderPaginationState,
} from "$lib/types/filetree";

type FiletreeState = ActionRegistrationInput["stores"]["ui"]["filetree"];

export function clone_filetree(ft: FiletreeState): {
  expanded_paths: SvelteSet<string>;
  load_states: SvelteMap<string, FolderLoadState>;
  error_messages: SvelteMap<string, string>;
  pagination: SvelteMap<string, FolderPaginationState>;
} {
  return {
    expanded_paths: new SvelteSet(ft.expanded_paths),
    load_states: new SvelteMap(ft.load_states),
    error_messages: new SvelteMap(ft.error_messages),
    pagination: new SvelteMap(ft.pagination),
  };
}

export function clear_folder_filetree_state(
  input: ActionRegistrationInput,
  folder_path: string,
) {
  const cloned = clone_filetree(input.stores.ui.filetree);
  cloned.load_states.delete(folder_path);
  cloned.error_messages.delete(folder_path);
  cloned.pagination.delete(folder_path);
  input.stores.ui.filetree = cloned;
}
