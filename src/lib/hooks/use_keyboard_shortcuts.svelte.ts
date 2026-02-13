export type KeyboardShortcuts = {
  handle_keydown_capture: (event: KeyboardEvent) => void;
  handle_keydown: (event: KeyboardEvent) => void;
};

export function use_keyboard_shortcuts(input: {
  is_enabled: () => boolean;
  is_blocked: () => boolean;
  is_omnibar_open: () => boolean;
  is_vault_switcher_open: () => boolean;
  on_toggle_omnibar: () => void;
  on_open_omnibar_commands: () => void;
  on_open_omnibar_notes: () => void;
  on_open_omnibar_all_vaults?: () => void;
  on_open_vault_switcher: () => void;
  on_close_vault_switcher: () => void;
  on_select_pinned_vault: (slot: number) => void;
  on_toggle_sidebar: () => void;
  on_toggle_find_in_file: () => void;
  on_open_vault_dashboard?: () => void;
  on_save: () => void;
  on_close_tab?: () => void;
  on_reopen_tab?: () => void;
  on_next_tab?: () => void;
  on_prev_tab?: () => void;
  on_switch_to_tab?: (index: number) => void;
  on_move_tab_left?: () => void;
  on_move_tab_right?: () => void;
  has_tabs?: () => boolean;
}): KeyboardShortcuts {
  const {
    is_enabled,
    is_blocked,
    is_omnibar_open,
    is_vault_switcher_open,
    on_toggle_omnibar,
    on_open_omnibar_commands,
    on_open_omnibar_notes,
    on_open_omnibar_all_vaults = on_open_omnibar_notes,
    on_open_vault_switcher,
    on_close_vault_switcher,
    on_select_pinned_vault,
    on_toggle_sidebar,
    on_toggle_find_in_file,
    on_open_vault_dashboard = () => {},
    on_save,
    on_close_tab = () => {},
    on_reopen_tab = () => {},
    on_next_tab = () => {},
    on_prev_tab = () => {},
    on_switch_to_tab = () => {},
    on_move_tab_left = () => {},
    on_move_tab_right = () => {},
    has_tabs = () => false,
  } = input;

  const is_mod_combo = (event: KeyboardEvent, key: string): boolean => {
    if (!(event.metaKey || event.ctrlKey)) return false;
    return event.key.toLowerCase() === key;
  };

  const tab_number_slot = (event: KeyboardEvent): number | null => {
    if (!(event.metaKey || event.ctrlKey)) return null;
    if (event.altKey || event.shiftKey) return null;
    if (event.key < "1" || event.key > "9") return null;
    return Number(event.key) - 1;
  };

  const handle_keydown_capture = (event: KeyboardEvent) => {
    if (is_mod_combo(event, "w")) {
      if (!is_enabled()) return;
      if (is_vault_switcher_open()) {
        event.preventDefault();
        event.stopPropagation();
        on_close_vault_switcher();
        return;
      }
      if (has_tabs()) {
        event.preventDefault();
        event.stopPropagation();
        if (is_blocked()) return;
        on_close_tab();
        return;
      }
      return;
    }

    if (is_mod_combo(event, "t") && event.shiftKey) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked()) return;
      on_reopen_tab();
      return;
    }

    if (is_mod_combo(event, "Tab")) {
      if (!is_enabled()) return;
      if (!has_tabs()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked()) return;
      if (event.shiftKey) {
        on_prev_tab();
      } else {
        on_next_tab();
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.altKey && !event.shiftKey) {
      if (event.key === "ArrowLeft") {
        if (!is_enabled()) return;
        event.preventDefault();
        event.stopPropagation();
        if (is_blocked()) return;
        on_move_tab_left();
        return;
      }
      if (event.key === "ArrowRight") {
        if (!is_enabled()) return;
        event.preventDefault();
        event.stopPropagation();
        if (is_blocked()) return;
        on_move_tab_right();
        return;
      }
    }

    const slot = tab_number_slot(event);
    if (slot !== null) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked()) return;
      if (has_tabs()) {
        on_switch_to_tab(slot);
      } else if (slot < 5) {
        on_select_pinned_vault(slot);
      }
      return;
    }

    if (is_mod_combo(event, "p")) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked() && !is_omnibar_open()) return;
      if (is_omnibar_open()) {
        on_toggle_omnibar();
      } else {
        on_open_omnibar_commands();
      }
      return;
    }

    if (is_mod_combo(event, "o")) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked() && !is_omnibar_open()) return;
      if (event.shiftKey) {
        if (is_blocked()) return;
        on_open_vault_switcher();
        return;
      }
      if (is_omnibar_open()) {
        on_toggle_omnibar();
      } else {
        on_open_omnibar_notes();
      }
      return;
    }

    if (is_mod_combo(event, "f")) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        if (is_blocked() && !is_omnibar_open()) return;
        on_open_omnibar_all_vaults();
        return;
      }
      if (is_blocked()) return;
      on_toggle_find_in_file();
      return;
    }

    if (is_mod_combo(event, "d") && event.shiftKey) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked()) return;
      on_open_vault_dashboard();
      return;
    }

    if (is_mod_combo(event, "b")) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked()) return;
      on_toggle_sidebar();
    }
  };

  const handle_keydown = (event: KeyboardEvent) => {
    if (!is_mod_combo(event, "s")) return;
    if (!is_enabled()) return;
    event.preventDefault();
    event.stopPropagation();
    if (is_blocked()) return;
    on_save();
  };

  return {
    handle_keydown_capture,
    handle_keydown,
  };
}
