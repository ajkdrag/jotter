import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { Tab, TabId } from "$lib/types/tab";
import type { NotePath } from "$lib/types/ids";
import { parent_folder_path } from "$lib/utils/path";
import { toast } from "svelte-sonner";

export function ensure_tab_capacity(input: ActionRegistrationInput): boolean {
  const { stores, services } = input;
  const max = stores.ui.editor_settings.max_open_tabs;
  if (stores.tab.tabs.length < max) return true;

  const victim = stores.tab.find_evictable_tab();
  if (!victim) {
    toast.error("All tabs have unsaved changes. Save or close a tab first.");
    return false;
  }

  const snapshot = stores.tab.get_snapshot(victim.id);
  stores.tab.push_closed_history({
    note_path: victim.note_path,
    title: victim.title,
    scroll_top: snapshot?.scroll_top ?? 0,
    cursor: snapshot?.cursor ?? null,
  });
  stores.tab.close_tab(victim.id);
  services.editor.close_buffer?.(victim.note_path);
  return true;
}

export function try_open_tab(
  input: ActionRegistrationInput,
  note_path: NotePath,
  title: string,
): Tab | null {
  const { stores } = input;
  const existing = stores.tab.find_tab_by_path(note_path);
  if (existing) {
    stores.tab.activate_tab(existing.id);
    return existing;
  }
  if (!ensure_tab_capacity(input)) return null;
  return stores.tab.open_tab(note_path, title);
}

export function register_tab_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  registry.register({
    id: ACTION_IDS.tab_activate,
    label: "Activate Tab",
    when: () => stores.tab.has_tabs,
    execute: async (tab_id: unknown) => {
      const id = String(tab_id);
      const tab = stores.tab.tabs.find((t) => t.id === id);
      if (!tab) return;

      await capture_active_tab_snapshot(input);
      stores.tab.activate_tab(id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_activate_by_index,
    label: "Switch to Tab by Number",
    when: () => stores.tab.has_tabs,
    execute: async (index: unknown) => {
      const i = Number(index);
      const tab = stores.tab.tabs[i];
      if (!tab) return;
      if (stores.tab.active_tab_id === tab.id) return;

      await capture_active_tab_snapshot(input);
      stores.tab.activate_tab(tab.id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_close,
    label: "Close Tab",
    shortcut: "CmdOrCtrl+W",
    when: () => stores.tab.has_tabs,
    execute: async (tab_id_arg?: unknown) => {
      const tab_id =
        typeof tab_id_arg === "string" ? tab_id_arg : stores.tab.active_tab_id;
      if (!tab_id) return;

      const tab = stores.tab.tabs.find((t) => t.id === tab_id);
      if (!tab) return;

      if (tab.is_pinned && !tab_id_arg) return;

      if (tab.is_dirty) {
        stores.ui.tab_close_confirm = {
          open: true,
          tab_id: tab.id,
          tab_title: tab.title,
          pending_dirty_tab_ids: [],
          close_mode: "single",
          keep_tab_id: null,
          apply_to_all: false,
        };
        return;
      }

      await close_tab_immediate(input, tab_id);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_close_other,
    label: "Close Other Tabs",
    when: () => stores.tab.tabs.length > 1,
    execute: async (tab_id: unknown) => {
      const id = String(tab_id);
      const closable = stores.tab.tabs.filter(
        (t) => t.id !== id && !t.is_pinned,
      );
      const dirty = closable.filter((t) => t.is_dirty);

      if (dirty.length > 0) {
        start_batch_close_confirm(stores, dirty, "other", id);
        return;
      }

      stores.tab.close_other_tabs(id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_close_right,
    label: "Close Tabs to the Right",
    execute: async (tab_id: unknown) => {
      const id = String(tab_id);
      const index = stores.tab.tabs.findIndex((t) => t.id === id);
      if (index === -1) return;

      const right_tabs = stores.tab.tabs.filter(
        (t, i) => i > index && !t.is_pinned,
      );
      const dirty = right_tabs.filter((t) => t.is_dirty);

      if (dirty.length > 0) {
        start_batch_close_confirm(stores, dirty, "right", id);
        return;
      }

      stores.tab.close_tabs_to_right(id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_close_all,
    label: "Close All Tabs",
    execute: () => {
      const dirty = stores.tab.get_dirty_tabs();

      if (dirty.length > 0) {
        start_batch_close_confirm(stores, dirty, "all", null);
        return;
      }

      stores.tab.close_all_tabs();
      stores.editor.clear_open_note();
    },
  });

  registry.register({
    id: ACTION_IDS.tab_next,
    label: "Next Tab",
    when: () => stores.tab.tabs.length > 1,
    execute: async () => {
      const tabs = stores.tab.tabs;
      const current_index = stores.tab.active_tab_index;
      if (current_index === -1) return;

      const next_index = (current_index + 1) % tabs.length;
      const next_tab = tabs[next_index];
      if (!next_tab) return;
      await capture_active_tab_snapshot(input);
      stores.tab.activate_tab(next_tab.id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_prev,
    label: "Previous Tab",
    when: () => stores.tab.tabs.length > 1,
    execute: async () => {
      const tabs = stores.tab.tabs;
      const current_index = stores.tab.active_tab_index;
      if (current_index === -1) return;

      const prev_index = (current_index - 1 + tabs.length) % tabs.length;
      const prev_tab = tabs[prev_index];
      if (!prev_tab) return;
      await capture_active_tab_snapshot(input);
      stores.tab.activate_tab(prev_tab.id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_reopen_closed,
    label: "Reopen Closed Tab",
    shortcut: "CmdOrCtrl+Shift+T",
    when: () => stores.tab.closed_tab_history.length > 0,
    execute: async () => {
      const entry = stores.tab.pop_closed_history();
      if (!entry) return;

      await capture_active_tab_snapshot(input);
      const tab = try_open_tab(input, entry.note_path, entry.title);
      if (!tab) return;

      const result = await services.note.open_note(entry.note_path, false);
      if (result.status === "opened") {
        stores.ui.set_selected_folder_path(result.selected_folder_path);
        if (entry.cursor || entry.scroll_top > 0) {
          stores.tab.set_snapshot(entry.note_path, {
            scroll_top: entry.scroll_top,
            cursor: entry.cursor,
          });
        }
      }
    },
  });

  registry.register({
    id: ACTION_IDS.tab_pin,
    label: "Pin Tab",
    execute: (tab_id: unknown) => {
      stores.tab.pin_tab(String(tab_id));
    },
  });

  registry.register({
    id: ACTION_IDS.tab_unpin,
    label: "Unpin Tab",
    execute: (tab_id: unknown) => {
      stores.tab.unpin_tab(String(tab_id));
    },
  });

  registry.register({
    id: ACTION_IDS.tab_move_left,
    label: "Move Tab Left",
    shortcut: "CmdOrCtrl+Alt+Left",
    when: () => stores.tab.active_tab_id !== null,
    execute: () => {
      if (!stores.tab.active_tab_id) return;
      stores.tab.move_tab_left(stores.tab.active_tab_id);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_move_right,
    label: "Move Tab Right",
    shortcut: "CmdOrCtrl+Alt+Right",
    when: () => stores.tab.active_tab_id !== null,
    execute: () => {
      if (!stores.tab.active_tab_id) return;
      stores.tab.move_tab_right(stores.tab.active_tab_id);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_copy_path,
    label: "Copy File Path",
    execute: async (tab_id: unknown) => {
      const id = String(tab_id);
      const tab = stores.tab.tabs.find((t) => t.id === id);
      if (!tab) return;

      try {
        await services.clipboard.copy_text(tab.note_path);
        toast.success("Path copied");
      } catch {
        toast.error("Failed to copy path");
      }
    },
  });

  registry.register({
    id: ACTION_IDS.tab_reveal_in_tree,
    label: "Reveal in File Tree",
    execute: async (tab_id: unknown) => {
      const id = String(tab_id);
      const tab = stores.tab.tabs.find((t) => t.id === id);
      if (!tab) return;

      await registry.execute(ACTION_IDS.filetree_reveal_note, {
        note_path: tab.note_path,
      });
    },
  });

  registry.register({
    id: ACTION_IDS.tab_confirm_close_save,
    label: "Save and Close Tab",
    execute: async () => {
      const { tab_id, close_mode, apply_to_all, pending_dirty_tab_ids } =
        stores.ui.tab_close_confirm;
      if (!tab_id) return;

      await save_dirty_tab(input, tab_id);

      if (close_mode === "single") {
        reset_close_confirm(stores);
        await close_tab_immediate(input, tab_id);
        return;
      }

      if (apply_to_all) {
        for (const pending_id of pending_dirty_tab_ids) {
          await save_dirty_tab(input, pending_id);
        }
        await execute_batch_close(input);
        return;
      }

      await advance_or_finish_batch(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_confirm_close_discard,
    label: "Discard and Close Tab",
    execute: async () => {
      const { tab_id, close_mode, apply_to_all, pending_dirty_tab_ids } =
        stores.ui.tab_close_confirm;
      if (!tab_id) return;

      stores.tab.set_dirty(tab_id, false);

      if (close_mode === "single") {
        reset_close_confirm(stores);
        await close_tab_immediate(input, tab_id);
        return;
      }

      if (apply_to_all) {
        for (const pending_id of pending_dirty_tab_ids) {
          stores.tab.set_dirty(pending_id, false);
        }
        await execute_batch_close(input);
        return;
      }

      await advance_or_finish_batch(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_cancel_close,
    label: "Cancel Close Tab",
    execute: () => {
      reset_close_confirm(stores);
    },
  });
}

export async function capture_active_tab_snapshot(
  input: ActionRegistrationInput,
) {
  const { stores, services } = input;
  const active_id = stores.tab.active_tab_id;
  if (!active_id) return;

  const flushed = services.editor.flush();
  if (flushed) {
    stores.editor.set_markdown(flushed.note_id, flushed.markdown);
  }

  const cursor = stores.editor.cursor;
  stores.tab.set_snapshot(active_id, {
    scroll_top: 0,
    cursor,
  });

  const open_note = stores.editor.open_note;
  if (open_note) {
    stores.tab.set_cached_note(active_id, open_note);
    stores.tab.set_dirty(active_id, open_note.is_dirty);
    if (open_note.is_dirty && stores.ui.editor_settings.autosave_enabled) {
      await services.note.save_note(null, true);
    }
  }
}

async function open_active_tab_note(input: ActionRegistrationInput) {
  const { stores, services } = input;
  const active_tab = stores.tab.active_tab;
  if (!active_tab) {
    stores.editor.clear_open_note();
    return;
  }

  const current_note = stores.editor.open_note;
  if (current_note && current_note.meta.path === active_tab.note_path) {
    return;
  }

  stores.ui.clear_selected_items();

  const cached = stores.tab.get_cached_note(active_tab.id);
  if (cached) {
    stores.editor.set_open_note(cached);
    const folder = parent_folder_path(active_tab.note_path);
    stores.ui.set_selected_folder_path(folder);
    return;
  }

  const result = await services.note.open_note(active_tab.note_path, false);
  if (result.status === "opened") {
    stores.ui.set_selected_folder_path(result.selected_folder_path);
    const open_note = stores.editor.open_note;
    if (open_note) {
      stores.tab.set_cached_note(active_tab.id, open_note);
    }
  }
}

function reset_close_confirm(stores: ActionRegistrationInput["stores"]) {
  stores.ui.tab_close_confirm = {
    open: false,
    tab_id: null,
    tab_title: "",
    pending_dirty_tab_ids: [],
    close_mode: "single",
    keep_tab_id: null,
    apply_to_all: false,
  };
}

function start_batch_close_confirm(
  stores: ActionRegistrationInput["stores"],
  dirty_tabs: Tab[],
  close_mode: "all" | "other" | "right",
  keep_tab_id: string | null,
) {
  const first = dirty_tabs[0];
  if (!first) return;
  stores.ui.tab_close_confirm = {
    open: true,
    tab_id: first.id,
    tab_title: first.title,
    pending_dirty_tab_ids: dirty_tabs.slice(1).map((t) => t.id),
    close_mode,
    keep_tab_id,
    apply_to_all: false,
  };
}

async function save_dirty_tab(
  input: ActionRegistrationInput,
  tab_id: string,
): Promise<void> {
  const { stores, services } = input;

  if (stores.tab.active_tab_id === tab_id) {
    await services.note.save_note(null, true);
    return;
  }

  const cached = stores.tab.get_cached_note(tab_id);
  if (cached) {
    await services.note.write_note_content(cached.meta.path, cached.markdown);
    stores.tab.set_dirty(tab_id, false);
  }
}

async function execute_batch_close(
  input: ActionRegistrationInput,
): Promise<void> {
  const { stores } = input;
  const { close_mode, keep_tab_id } = stores.ui.tab_close_confirm;

  reset_close_confirm(stores);

  switch (close_mode) {
    case "all": {
      stores.tab.close_all_tabs();
      stores.editor.clear_open_note();
      break;
    }
    case "other": {
      if (keep_tab_id) {
        stores.tab.close_other_tabs(keep_tab_id);
        await open_active_tab_note(input);
      }
      break;
    }
    case "right": {
      if (keep_tab_id) {
        stores.tab.close_tabs_to_right(keep_tab_id);
        await open_active_tab_note(input);
      }
      break;
    }
  }
}

async function advance_or_finish_batch(
  input: ActionRegistrationInput,
): Promise<void> {
  const { stores } = input;
  const { pending_dirty_tab_ids } = stores.ui.tab_close_confirm;

  if (pending_dirty_tab_ids.length > 0) {
    const next_id = pending_dirty_tab_ids[0];
    const next_tab = stores.tab.tabs.find((t) => t.id === next_id);
    stores.ui.tab_close_confirm = {
      ...stores.ui.tab_close_confirm,
      tab_id: next_id ?? null,
      tab_title: next_tab?.title ?? "",
      pending_dirty_tab_ids: pending_dirty_tab_ids.slice(1),
      apply_to_all: false,
    };
    return;
  }

  await execute_batch_close(input);
}

async function close_tab_immediate(
  input: ActionRegistrationInput,
  tab_id: TabId,
) {
  const { stores, services } = input;
  const tab = stores.tab.tabs.find((t) => t.id === tab_id);
  if (!tab) return;

  const snapshot = stores.tab.get_snapshot(tab_id);
  stores.tab.push_closed_history({
    note_path: tab.note_path,
    title: tab.title,
    scroll_top: snapshot?.scroll_top ?? 0,
    cursor: snapshot?.cursor ?? null,
  });

  const was_active = stores.tab.active_tab_id === tab_id;
  stores.tab.close_tab(tab_id);
  services.editor.close_buffer?.(tab.note_path);

  if (was_active) {
    await open_active_tab_note(input);
  }
}
