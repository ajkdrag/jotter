import { SvelteMap } from "svelte/reactivity";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type {
  FolderLoadState,
  FolderPaginationState,
} from "$lib/types/filetree";

export function clear_folder_filetree_state(
  input: ActionRegistrationInput,
  folder_path: string,
) {
  const load_states = new SvelteMap<string, FolderLoadState>(
    input.stores.ui.filetree.load_states,
  );
  load_states.delete(folder_path);

  const error_messages = new SvelteMap<string, string>(
    input.stores.ui.filetree.error_messages,
  );
  error_messages.delete(folder_path);

  const pagination = new SvelteMap<string, FolderPaginationState>(
    input.stores.ui.filetree.pagination,
  );
  pagination.delete(folder_path);

  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    load_states,
    error_messages,
    pagination,
  };
}
