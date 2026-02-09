import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { clear_folder_filetree_state } from "$lib/actions/filetree_state";
import { PAGE_SIZE } from "$lib/constants/pagination";
import type {
  FolderLoadState,
  FolderPaginationState,
} from "$lib/types/filetree";
import { parent_folder_path } from "$lib/utils/filetree";

function should_load_folder(state: FolderLoadState | undefined): boolean {
  return !state || state === "unloaded" || state === "error";
}

function set_load_state(
  input: ActionRegistrationInput,
  path: string,
  state: FolderLoadState,
  error: string | null,
) {
  const load_states = new SvelteMap(input.stores.ui.filetree.load_states);
  load_states.set(path, state);

  const error_messages = new SvelteMap(input.stores.ui.filetree.error_messages);
  if (error) {
    error_messages.set(path, error);
  } else {
    error_messages.delete(path);
  }

  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    load_states,
    error_messages,
  };
}

function set_pagination(
  input: ActionRegistrationInput,
  path: string,
  state: FolderPaginationState,
) {
  const pagination = new SvelteMap(input.stores.ui.filetree.pagination);
  pagination.set(path, state);
  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    pagination,
  };
}

function clear_folder_pagination(input: ActionRegistrationInput, path: string) {
  const pagination = new SvelteMap(input.stores.ui.filetree.pagination);
  pagination.delete(path);
  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    pagination,
  };
}

function close_create_dialog(input: ActionRegistrationInput) {
  input.stores.ui.create_folder_dialog = {
    open: false,
    parent_path: "",
    folder_name: "",
  };
}

function close_delete_dialog(input: ActionRegistrationInput) {
  input.stores.ui.delete_folder_dialog = {
    open: false,
    folder_path: null,
    affected_note_count: 0,
    affected_folder_count: 0,
    status: "idle",
  };
}

function close_rename_dialog(input: ActionRegistrationInput) {
  input.stores.ui.rename_folder_dialog = {
    open: false,
    folder_path: null,
    new_name: "",
  };
}

function folder_name_from_path(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

function build_folder_path_from_name(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function remove_expanded_paths(
  input: ActionRegistrationInput,
  folder_path: string,
) {
  const prefix = `${folder_path}/`;

  const expanded_paths = new SvelteSet<string>();
  for (const path of input.stores.ui.filetree.expanded_paths) {
    if (path === folder_path || path.startsWith(prefix)) {
      continue;
    }
    expanded_paths.add(path);
  }

  const load_states = new SvelteMap<string, FolderLoadState>();
  for (const [path, state] of input.stores.ui.filetree.load_states) {
    if (path === folder_path || path.startsWith(prefix)) {
      continue;
    }
    load_states.set(path, state);
  }

  const error_messages = new SvelteMap<string, string>();
  for (const [path, message] of input.stores.ui.filetree.error_messages) {
    if (path === folder_path || path.startsWith(prefix)) {
      continue;
    }
    error_messages.set(path, message);
  }

  const pagination = new SvelteMap<string, FolderPaginationState>();
  for (const [path, state] of input.stores.ui.filetree.pagination) {
    if (path === folder_path || path.startsWith(prefix)) {
      continue;
    }
    pagination.set(path, state);
  }

  input.stores.ui.filetree = {
    expanded_paths,
    load_states,
    error_messages,
    pagination,
  };
}

function remap_path(path: string, old_path: string, new_path: string): string {
  const old_prefix = `${old_path}/`;
  const new_prefix = `${new_path}/`;

  if (path === old_path) {
    return new_path;
  }

  if (path.startsWith(old_prefix)) {
    return `${new_prefix}${path.slice(old_prefix.length)}`;
  }

  return path;
}

function remap_expanded_paths(
  input: ActionRegistrationInput,
  old_path: string,
  new_path: string,
) {
  const expanded_paths = new SvelteSet<string>();
  for (const path of input.stores.ui.filetree.expanded_paths) {
    expanded_paths.add(remap_path(path, old_path, new_path));
  }

  const load_states = new SvelteMap<string, FolderLoadState>();
  for (const [path, state] of input.stores.ui.filetree.load_states) {
    load_states.set(remap_path(path, old_path, new_path), state);
  }

  const error_messages = new SvelteMap<string, string>();
  for (const [path, message] of input.stores.ui.filetree.error_messages) {
    error_messages.set(remap_path(path, old_path, new_path), message);
  }

  const pagination = new SvelteMap<string, FolderPaginationState>();
  for (const [path, state] of input.stores.ui.filetree.pagination) {
    pagination.set(remap_path(path, old_path, new_path), state);
  }

  input.stores.ui.filetree = {
    expanded_paths,
    load_states,
    error_messages,
    pagination,
  };
}

async function load_folder(
  input: ActionRegistrationInput,
  path: string,
): Promise<void> {
  const current_state = input.stores.ui.filetree.load_states.get(path);
  if (!should_load_folder(current_state)) {
    return;
  }

  set_load_state(input, path, "loading", null);
  const generation = input.stores.vault.generation;
  const result = await input.services.folder.load_folder(path, generation);

  if (result.status === "loaded") {
    set_load_state(input, path, "loaded", null);
    set_pagination(input, path, {
      loaded_count: Math.min(PAGE_SIZE, result.total_count),
      total_count: result.total_count,
      load_state: "idle",
      error_message: null,
    });
    return;
  }

  if (result.status === "failed") {
    set_load_state(input, path, "error", result.error);
    clear_folder_pagination(input, path);
  }
}

export function register_folder_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;
  const loading_more = new Set<string>();

  registry.register({
    id: ACTION_IDS.folder_request_create,
    label: "Request Create Folder",
    execute: (parent_path: unknown) => {
      stores.ui.create_folder_dialog = {
        open: true,
        parent_path: String(parent_path),
        folder_name: "",
      };
      stores.op.reset("folder.create");
    },
  });

  registry.register({
    id: ACTION_IDS.folder_update_create_name,
    label: "Update Create Folder Name",
    execute: (name: unknown) => {
      stores.ui.create_folder_dialog.folder_name = String(name);
    },
  });

  registry.register({
    id: ACTION_IDS.folder_confirm_create,
    label: "Confirm Create Folder",
    execute: async () => {
      const { parent_path, folder_name } = stores.ui.create_folder_dialog;
      const result = await services.folder.create_folder(
        parent_path,
        folder_name,
      );
      if (result.status === "success") {
        clear_folder_filetree_state(input, parent_path);
        close_create_dialog(input);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.folder_cancel_create,
    label: "Cancel Create Folder",
    execute: () => {
      close_create_dialog(input);
      stores.op.reset("folder.create");
    },
  });

  registry.register({
    id: ACTION_IDS.folder_toggle,
    label: "Toggle Folder",
    execute: async (path: unknown) => {
      const folder_path = String(path);
      const expanded_paths = new SvelteSet(stores.ui.filetree.expanded_paths);

      if (expanded_paths.has(folder_path)) {
        expanded_paths.delete(folder_path);
        stores.ui.filetree = {
          ...stores.ui.filetree,
          expanded_paths,
        };
        return;
      }

      expanded_paths.add(folder_path);
      stores.ui.filetree = {
        ...stores.ui.filetree,
        expanded_paths,
      };

      await load_folder(input, folder_path);
    },
  });

  registry.register({
    id: ACTION_IDS.folder_load_more,
    label: "Load More Folder Contents",
    execute: async (path: unknown) => {
      const folder_path = String(path);
      if (loading_more.has(folder_path)) {
        return;
      }

      const pagination = stores.ui.filetree.pagination.get(folder_path);
      if (!pagination || pagination.loaded_count >= pagination.total_count) {
        return;
      }

      set_pagination(input, folder_path, {
        ...pagination,
        load_state: "loading",
        error_message: null,
      });

      loading_more.add(folder_path);
      try {
        const generation = stores.vault.generation;
        const result = await services.folder.load_folder_page(
          folder_path,
          pagination.loaded_count,
          generation,
        );
        if (result.status === "loaded") {
          set_pagination(input, folder_path, {
            loaded_count: Math.min(
              pagination.loaded_count + PAGE_SIZE,
              result.total_count,
            ),
            total_count: result.total_count,
            load_state: "idle",
            error_message: null,
          });
        } else if (result.status === "failed") {
          set_pagination(input, folder_path, {
            ...pagination,
            load_state: "error",
            error_message: result.error,
          });
        } else {
          set_pagination(input, folder_path, {
            ...pagination,
            load_state: "idle",
            error_message: null,
          });
        }
      } finally {
        loading_more.delete(folder_path);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.folder_retry_load,
    label: "Retry Folder Load",
    execute: async (path: unknown) => {
      await load_folder(input, String(path));
    },
  });

  registry.register({
    id: ACTION_IDS.folder_collapse_all,
    label: "Collapse All Folders",
    execute: () => {
      stores.ui.filetree = {
        ...stores.ui.filetree,
        expanded_paths: new SvelteSet<string>(),
      };
    },
  });

  registry.register({
    id: ACTION_IDS.folder_refresh_tree,
    label: "Refresh File Tree",
    execute: async () => {
      stores.vault.bump_generation();

      const current_filetree = stores.ui.filetree;
      const loaded_paths = new Set<string>([""]);
      for (const [path, state] of current_filetree.load_states) {
        if (state === "loaded" || state === "error") {
          loaded_paths.add(path);
        }
      }

      stores.ui.filetree = {
        expanded_paths: new SvelteSet(current_filetree.expanded_paths),
        load_states: new SvelteMap<string, FolderLoadState>(),
        error_messages: new SvelteMap<string, string>(),
        pagination: new SvelteMap<string, FolderPaginationState>(),
      };

      stores.notes.reset();

      await load_folder(input, "");
      const non_root = Array.from(loaded_paths).filter((path) => path !== "");
      await Promise.all(non_root.map((path) => load_folder(input, path)));

      const fresh_folder_paths = new Set(stores.notes.folder_paths);

      const expanded_paths = new SvelteSet<string>();
      for (const path of stores.ui.filetree.expanded_paths) {
        if (path === "" || fresh_folder_paths.has(path)) {
          expanded_paths.add(path);
        }
      }

      const load_states = new SvelteMap<string, FolderLoadState>();
      for (const [path, state] of stores.ui.filetree.load_states) {
        if (path === "" || fresh_folder_paths.has(path)) {
          load_states.set(path, state);
        }
      }

      const error_messages = new SvelteMap<string, string>();
      for (const [path, message] of stores.ui.filetree.error_messages) {
        if (path === "" || fresh_folder_paths.has(path)) {
          error_messages.set(path, message);
        }
      }

      const pagination = new SvelteMap<string, FolderPaginationState>();
      for (const [path, state] of stores.ui.filetree.pagination) {
        if (path === "" || fresh_folder_paths.has(path)) {
          pagination.set(path, state);
        }
      }

      stores.ui.filetree = {
        expanded_paths,
        load_states,
        error_messages,
        pagination,
      };
    },
  });

  registry.register({
    id: ACTION_IDS.folder_request_delete,
    label: "Request Delete Folder",
    execute: async (folder_path: unknown) => {
      const normalized_path = String(folder_path);

      stores.ui.delete_folder_dialog = {
        open: true,
        folder_path: normalized_path,
        affected_note_count: 0,
        affected_folder_count: 0,
        status: "fetching_stats",
      };

      stores.op.reset("folder.delete");
      const result = await services.folder.load_delete_stats(normalized_path);

      if (result.status === "ready") {
        stores.ui.delete_folder_dialog = {
          ...stores.ui.delete_folder_dialog,
          status: "confirming",
          affected_note_count: result.affected_note_count,
          affected_folder_count: result.affected_folder_count,
        };
      }
    },
  });

  async function execute_delete_folder() {
    const folder_path = stores.ui.delete_folder_dialog.folder_path;
    if (!folder_path) return;

    const result = await services.folder.delete_folder(folder_path);
    if (result.status === "success") {
      const parent_path = parent_folder_path(folder_path);
      clear_folder_filetree_state(input, parent_path);
      remove_expanded_paths(input, folder_path);
      close_delete_dialog(input);
    }
  }

  registry.register({
    id: ACTION_IDS.folder_confirm_delete,
    label: "Confirm Delete Folder",
    execute: execute_delete_folder,
  });

  registry.register({
    id: ACTION_IDS.folder_cancel_delete,
    label: "Cancel Delete Folder",
    execute: () => {
      close_delete_dialog(input);
      stores.op.reset("folder.delete");
    },
  });

  registry.register({
    id: ACTION_IDS.folder_retry_delete,
    label: "Retry Delete Folder",
    execute: execute_delete_folder,
  });

  registry.register({
    id: ACTION_IDS.folder_request_rename,
    label: "Request Rename Folder",
    execute: (folder_path: unknown) => {
      const path = String(folder_path);
      stores.ui.rename_folder_dialog = {
        open: true,
        folder_path: path,
        new_name: folder_name_from_path(path),
      };
      stores.op.reset("folder.rename");
    },
  });

  registry.register({
    id: ACTION_IDS.folder_rename,
    label: "Update Rename Folder Name",
    execute: (name: unknown) => {
      stores.ui.rename_folder_dialog.new_name = String(name);
    },
  });

  async function execute_rename_folder() {
    const folder_path = stores.ui.rename_folder_dialog.folder_path;
    const new_name = stores.ui.rename_folder_dialog.new_name.trim();
    if (!folder_path || !new_name) return;

    const parent = parent_folder_path(folder_path);
    const new_path = build_folder_path_from_name(parent, new_name);

    const result = await services.folder.rename_folder(folder_path, new_path);
    if (result.status === "success") {
      const new_parent = parent_folder_path(new_path);
      clear_folder_filetree_state(input, parent);
      if (new_parent !== parent) {
        clear_folder_filetree_state(input, new_parent);
      }
      remap_expanded_paths(input, folder_path, new_path);
      close_rename_dialog(input);
    }
  }

  registry.register({
    id: ACTION_IDS.folder_confirm_rename,
    label: "Confirm Rename Folder",
    execute: execute_rename_folder,
  });

  registry.register({
    id: ACTION_IDS.folder_cancel_rename,
    label: "Cancel Rename Folder",
    execute: () => {
      close_rename_dialog(input);
      stores.op.reset("folder.rename");
    },
  });

  registry.register({
    id: ACTION_IDS.folder_retry_rename,
    label: "Retry Rename Folder",
    execute: execute_rename_folder,
  });
}
