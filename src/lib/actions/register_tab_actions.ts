import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { TabId } from "$lib/types/tab";
import { parent_folder_path } from "$lib/utils/path";
import { toast } from "svelte-sonner";

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
      const dirty_others = stores.tab.tabs.filter(
        (t) => t.id !== id && !t.is_pinned && t.is_dirty,
      );
      for (const dt of dirty_others) {
        stores.tab.set_dirty(dt.id, false);
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
      stores.tab.close_tabs_to_right(id);
      await open_active_tab_note(input);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_close_all,
    label: "Close All Tabs",
    execute: () => {
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
      stores.tab.open_tab(entry.note_path, entry.title);

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
    execute: (tab_id: unknown) => {
      const id = String(tab_id);
      const tab = stores.tab.tabs.find((t) => t.id === id);
      if (!tab) return;

      const folder = parent_folder_path(tab.note_path);
      stores.ui.set_selected_folder_path(folder);
      stores.ui.set_sidebar_view("explorer");
    },
  });

  registry.register({
    id: ACTION_IDS.tab_confirm_close_save,
    label: "Save and Close Tab",
    execute: async () => {
      const tab_id = stores.ui.tab_close_confirm.tab_id;
      if (!tab_id) return;

      stores.ui.tab_close_confirm = {
        open: false,
        tab_id: null,
        tab_title: "",
      };

      const tab = stores.tab.tabs.find((t) => t.id === tab_id);
      if (!tab) return;

      if (stores.tab.active_tab_id !== tab_id) {
        await capture_active_tab_snapshot(input);
        stores.tab.activate_tab(tab_id);
        await open_active_tab_note(input);
      }

      const save_result = await services.note.save_note(null, true);
      if (save_result.status === "saved") {
        await close_tab_immediate(input, tab_id);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.tab_confirm_close_discard,
    label: "Discard and Close Tab",
    execute: async () => {
      const tab_id = stores.ui.tab_close_confirm.tab_id;
      if (!tab_id) return;

      stores.ui.tab_close_confirm = {
        open: false,
        tab_id: null,
        tab_title: "",
      };
      stores.tab.set_dirty(tab_id, false);
      await close_tab_immediate(input, tab_id);
    },
  });

  registry.register({
    id: ACTION_IDS.tab_cancel_close,
    label: "Cancel Close Tab",
    execute: () => {
      stores.ui.tab_close_confirm = {
        open: false,
        tab_id: null,
        tab_title: "",
      };
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
