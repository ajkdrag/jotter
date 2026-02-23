import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { clear_folder_filetree_state } from "$lib/actions/filetree_state";
import { PAGE_SIZE } from "$lib/constants/pagination";
import type {
  FolderLoadState,
  FolderPaginationState,
  MoveItem,
} from "$lib/types/filetree";
import { create_logger } from "$lib/utils/logger";
import { parent_folder_path } from "$lib/utils/path";
import { get_invalid_drop_reason } from "$lib/domain/filetree";

const log = create_logger("folder_actions");

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

function parse_reveal_note_path(input: unknown): string {
  if (input && typeof input === "object" && "note_path" in input) {
    const record = input as Record<string, unknown>;
    if (typeof record.note_path === "string") {
      return record.note_path;
    }
  }
  return String(input);
}

function ancestor_folder_paths(note_path: string): string[] {
  const segments = note_path.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return [];
  }

  const folders = segments.slice(0, -1);
  const result: string[] = [];
  for (let i = 0; i < folders.length; i += 1) {
    result.push(folders.slice(0, i + 1).join("/"));
  }
  return result;
}

function is_valid_folder_name(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.includes("/") &&
    trimmed !== "." &&
    trimmed !== ".."
  );
}

function transform_filetree_paths(
  input: ActionRegistrationInput,
  transform: (path: string) => string | null,
) {
  const filetree = input.stores.ui.filetree;

  const expanded_paths = new SvelteSet<string>();
  for (const path of filetree.expanded_paths) {
    const result = transform(path);
    if (result !== null) {
      expanded_paths.add(result);
    }
  }

  const load_states = new SvelteMap<string, FolderLoadState>();
  for (const [path, state] of filetree.load_states) {
    const result = transform(path);
    if (result !== null) {
      load_states.set(result, state);
    }
  }

  const error_messages = new SvelteMap<string, string>();
  for (const [path, message] of filetree.error_messages) {
    const result = transform(path);
    if (result !== null) {
      error_messages.set(result, message);
    }
  }

  const pagination = new SvelteMap<string, FolderPaginationState>();
  for (const [path, state] of filetree.pagination) {
    const result = transform(path);
    if (result !== null) {
      pagination.set(result, state);
    }
  }

  input.stores.ui.filetree = {
    expanded_paths,
    load_states,
    error_messages,
    pagination,
  };
}

function remove_expanded_paths(
  input: ActionRegistrationInput,
  folder_path: string,
) {
  const prefix = `${folder_path}/`;
  transform_filetree_paths(input, (path) =>
    path === folder_path || path.startsWith(prefix) ? null : path,
  );
}

function remap_path(path: string, old_path: string, new_path: string): string {
  if (path === old_path) {
    return new_path;
  }

  const old_prefix = `${old_path}/`;
  if (path.startsWith(old_prefix)) {
    return `${new_path}/${path.slice(old_prefix.length)}`;
  }

  return path;
}

function remap_expanded_paths(
  input: ActionRegistrationInput,
  old_path: string,
  new_path: string,
) {
  transform_filetree_paths(input, (path) =>
    remap_path(path, old_path, new_path),
  );
}

function remap_ui_paths_after_move(
  input: ActionRegistrationInput,
  old_path: string,
  new_path: string,
  is_folder: boolean,
) {
  if (is_folder) {
    input.stores.ui.selected_folder_path = remap_path(
      input.stores.ui.selected_folder_path,
      old_path,
      new_path,
    );
    input.stores.ui.filetree_revealed_note_path = remap_path(
      input.stores.ui.filetree_revealed_note_path,
      old_path,
      new_path,
    );
    remap_expanded_paths(input, old_path, new_path);
    return;
  }

  if (input.stores.ui.filetree_revealed_note_path === old_path) {
    input.stores.ui.filetree_revealed_note_path = new_path;
  }
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

  function close_move_conflict_dialog() {
    stores.ui.filetree_move_conflict_dialog = {
      open: false,
      target_folder: "",
      items: [],
      conflicts: [],
    };
  }

  registry.register({
    id: ACTION_IDS.folder_request_create,
    label: "Request Create Folder",
    execute: (parent_path: unknown) => {
      stores.ui.create_folder_dialog = {
        open: true,
        parent_path: String(parent_path),
        folder_name: "",
      };
      services.folder.reset_create_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.filetree_select_item,
    label: "Select File Tree Item",
    execute: (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return;
      }
      const record = payload as Record<string, unknown>;
      const path = typeof record.path === "string" ? record.path : "";
      const ordered_paths = Array.isArray(record.ordered_paths)
        ? record.ordered_paths.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      const shift_key = Boolean(record.shift_key);
      const additive_key = Boolean(record.additive_key);
      if (!path) {
        return;
      }
      if (shift_key) {
        stores.ui.select_item_range(ordered_paths, path);
        return;
      }
      if (additive_key) {
        stores.ui.toggle_selected_item(path);
        return;
      }
      stores.ui.set_single_selected_item(path);
    },
  });

  registry.register({
    id: ACTION_IDS.filetree_clear_selection,
    label: "Clear File Tree Selection",
    execute: () => {
      stores.ui.clear_selected_items();
    },
  });

  registry.register({
    id: ACTION_IDS.folder_update_create_name,
    label: "Update Create Folder Name",
    execute: (name: unknown) => {
      stores.ui.create_folder_dialog.folder_name = String(name);
    },
  });

  async function execute_move_items(
    items: MoveItem[],
    target_folder: string,
    overwrite: boolean,
  ) {
    const invalid_reason = get_invalid_drop_reason(items, target_folder);
    if (invalid_reason) {
      log.warn("Invalid drop target", { target_folder, invalid_reason });
      return;
    }

    const moving_paths = new Set(items.map((item) => item.path.toLowerCase()));
    const conflict_entries = services.folder
      .build_move_preview(items, target_folder)
      .filter((item) => {
        if (moving_paths.has(item.new_path.toLowerCase())) {
          return false;
        }
        if (item.is_folder) {
          return stores.notes.folder_paths.some(
            (folder_path) =>
              folder_path.toLowerCase() === item.new_path.toLowerCase(),
          );
        }
        return stores.notes.notes.some(
          (note) => note.path.toLowerCase() === item.new_path.toLowerCase(),
        );
      })
      .map((item) => ({
        path: item.path,
        new_path: item.new_path,
        error: "target already exists",
      }));

    if (conflict_entries.length > 0 && !overwrite) {
      stores.ui.filetree_move_conflict_dialog = {
        open: true,
        target_folder,
        items,
        conflicts: conflict_entries,
      };
      return;
    }

    const result = await services.folder.move_items(
      items,
      target_folder,
      overwrite,
    );
    if (result.status !== "success") {
      return;
    }

    stores.vault.bump_generation();
    close_move_conflict_dialog();

    for (const move_result of result.results) {
      const item = items.find((entry) => entry.path === move_result.path);
      if (!item || !move_result.success) {
        continue;
      }

      remap_ui_paths_after_move(
        input,
        move_result.path,
        move_result.new_path,
        item.is_folder,
      );

      if (item.is_folder) {
        clear_folder_filetree_state(input, move_result.path);
        clear_folder_filetree_state(input, move_result.new_path);
      }
      clear_folder_filetree_state(input, parent_folder_path(move_result.path));
      clear_folder_filetree_state(
        input,
        parent_folder_path(move_result.new_path),
      );
    }

    stores.ui.clear_selected_items();
  }

  registry.register({
    id: ACTION_IDS.filetree_move_items,
    label: "Move File Tree Items",
    execute: async (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return;
      }
      const record = payload as Record<string, unknown>;
      const target_folder =
        typeof record.target_folder === "string" ? record.target_folder : "";
      const overwrite = Boolean(record.overwrite);
      const input_items = Array.isArray(record.items) ? record.items : [];
      const items: MoveItem[] = input_items
        .filter(
          (entry): entry is { path: string; is_folder: boolean } =>
            !!entry &&
            typeof entry === "object" &&
            "path" in entry &&
            "is_folder" in entry,
        )
        .map((entry) => ({
          path: entry.path,
          is_folder: entry.is_folder,
        }));
      if (items.length === 0) {
        return;
      }
      await execute_move_items(items, target_folder, overwrite);
    },
  });

  registry.register({
    id: ACTION_IDS.filetree_confirm_move_overwrite,
    label: "Confirm File Tree Move Overwrite",
    execute: async () => {
      const dialog = stores.ui.filetree_move_conflict_dialog;
      if (!dialog.open) {
        return;
      }
      await execute_move_items(dialog.items, dialog.target_folder, true);
    },
  });

  registry.register({
    id: ACTION_IDS.filetree_skip_move_conflicts,
    label: "Skip File Tree Move Conflicts",
    execute: async () => {
      const dialog = stores.ui.filetree_move_conflict_dialog;
      if (!dialog.open) {
        return;
      }
      const blocked = new Set(
        dialog.conflicts.map((entry) => entry.path.toLowerCase()),
      );
      const items = dialog.items.filter(
        (entry) => !blocked.has(entry.path.toLowerCase()),
      );
      if (items.length === 0) {
        close_move_conflict_dialog();
        return;
      }
      await execute_move_items(items, dialog.target_folder, false);
    },
  });

  registry.register({
    id: ACTION_IDS.filetree_cancel_move_conflicts,
    label: "Cancel File Tree Move Conflicts",
    execute: () => {
      close_move_conflict_dialog();
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
      services.folder.reset_create_operation();
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
    id: ACTION_IDS.filetree_reveal_note,
    label: "Reveal Note In File Tree",
    execute: (note_input: unknown) => {
      const note_path = parse_reveal_note_path(note_input).trim();
      if (!note_path) return;

      const expanded_paths = new SvelteSet(stores.ui.filetree.expanded_paths);
      for (const folder_path of ancestor_folder_paths(note_path)) {
        expanded_paths.add(folder_path);
      }

      stores.ui.filetree = {
        ...stores.ui.filetree,
        expanded_paths,
      };

      const folder = parent_folder_path(note_path);
      stores.ui.set_selected_folder_path(folder);
      stores.ui.set_filetree_revealed_note_path(note_path);
      stores.ui.set_sidebar_view("explorer");
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

      stores.notes.reset_notes_and_folders();

      await load_folder(input, "");
      const non_root = Array.from(loaded_paths).filter((path) => path !== "");
      await Promise.all(non_root.map((path) => load_folder(input, path)));

      const fresh_folder_paths = new Set(stores.notes.folder_paths);
      transform_filetree_paths(input, (path) =>
        path === "" || fresh_folder_paths.has(path) ? path : null,
      );
    },
  });

  async function load_delete_stats_for_dialog(folder_path: string) {
    const result = await services.folder.load_delete_stats(folder_path);

    if (result.status === "ready") {
      stores.ui.delete_folder_dialog = {
        ...stores.ui.delete_folder_dialog,
        status: "confirming",
        affected_note_count: result.affected_note_count,
        affected_folder_count: result.affected_folder_count,
      };
      return;
    }

    if (result.status === "failed") {
      stores.ui.delete_folder_dialog = {
        ...stores.ui.delete_folder_dialog,
        status: "error",
      };
      return;
    }

    close_delete_dialog(input);
  }

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

      services.folder.reset_delete_operation();
      services.folder.reset_delete_stats_operation();
      await load_delete_stats_for_dialog(normalized_path);
    },
  });

  async function execute_delete_folder() {
    const folder_path = stores.ui.delete_folder_dialog.folder_path;
    if (!folder_path) return;

    const result = await services.folder.delete_folder(folder_path);
    if (result.status === "success") {
      close_delete_dialog(input);
      const parent_path = parent_folder_path(folder_path);
      remove_expanded_paths(input, folder_path);
      clear_folder_filetree_state(input, parent_path);

      const folder_prefix = `${folder_path}/`;
      void services.folder
        .remove_notes_by_prefix(folder_prefix)
        .catch((err: unknown) => {
          log.error("Background index cleanup failed", {
            folder_path,
            error: err,
          });
        });
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
      services.folder.reset_delete_operation();
      services.folder.reset_delete_stats_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.folder_retry_delete,
    label: "Retry Delete Folder",
    execute: async () => {
      if (stores.ui.delete_folder_dialog.status === "error") {
        const folder_path = stores.ui.delete_folder_dialog.folder_path;
        if (!folder_path) return;

        stores.ui.delete_folder_dialog = {
          ...stores.ui.delete_folder_dialog,
          status: "fetching_stats",
        };
        services.folder.reset_delete_stats_operation();
        await load_delete_stats_for_dialog(folder_path);
        return;
      }
      await execute_delete_folder();
    },
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
      services.folder.reset_rename_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.folder_update_rename_name,
    label: "Update Rename Folder Name",
    execute: (name: unknown) => {
      stores.ui.rename_folder_dialog.new_name = String(name);
    },
  });

  function execute_rename_folder() {
    const folder_path = stores.ui.rename_folder_dialog.folder_path;
    const new_name = stores.ui.rename_folder_dialog.new_name.trim();
    if (!folder_path || !is_valid_folder_name(new_name)) return;
    if (stores.op.is_pending("folder.rename")) return;

    const parent = parent_folder_path(folder_path);
    const new_path = build_folder_path_from_name(parent, new_name);

    close_rename_dialog(input);

    void handle_folder_rename_async(folder_path, new_name, new_path, parent);
  }

  async function handle_folder_rename_async(
    folder_path: string,
    new_name: string,
    new_path: string,
    parent: string,
  ) {
    try {
      const result = await services.folder.rename_folder(folder_path, new_path);
      if (result.status !== "success") {
        stores.ui.rename_folder_dialog = {
          open: true,
          folder_path,
          new_name,
        };
        return;
      }

      stores.vault.bump_generation();
      services.folder.apply_folder_rename(folder_path, new_path);
      remap_expanded_paths(input, folder_path, new_path);

      clear_folder_filetree_state(input, folder_path);
      clear_folder_filetree_state(input, new_path);
      clear_folder_filetree_state(input, parent);
      const new_parent = parent_folder_path(new_path);
      if (new_parent !== parent) {
        clear_folder_filetree_state(input, new_parent);
      }

      const old_prefix = `${folder_path}/`;
      const new_prefix = `${new_path}/`;
      stores.tab.update_tab_path_prefix(old_prefix, new_prefix);
      void services.folder
        .rename_folder_index(old_prefix, new_prefix)
        .catch((err: unknown) => {
          log.error("Background index rename failed", {
            folder_path,
            error: err,
          });
        });
    } catch (err) {
      log.error("Unexpected rename flow failure", { folder_path, error: err });
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
      services.folder.reset_rename_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.folder_retry_rename,
    label: "Retry Rename Folder",
    execute: execute_rename_folder,
  });

  registry.register({
    id: ACTION_IDS.folder_toggle_star,
    label: "Toggle Star",
    execute: (folder_path: unknown) => {
      const path = String(folder_path);
      if (!path) return;
      stores.notes.toggle_star_path(path);
    },
  });

  registry.register({
    id: ACTION_IDS.filetree_toggle_star_selection,
    label: "Toggle Star (Selection)",
    execute: (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const record = payload as Record<string, unknown>;
      const paths = Array.isArray(record.paths)
        ? record.paths.filter((p): p is string => typeof p === "string")
        : [];
      if (paths.length === 0) return;
      const all_starred = Boolean(record.all_starred);
      for (const path of paths) {
        const is_currently_starred = stores.notes.is_starred_path(path);
        if (all_starred && is_currently_starred) {
          stores.notes.toggle_star_path(path);
        } else if (!all_starred && !is_currently_starred) {
          stores.notes.toggle_star_path(path);
        }
      }
    },
  });
}
