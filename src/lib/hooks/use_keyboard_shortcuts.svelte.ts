export type KeyboardShortcuts = {
  handle_keydown_capture: (event: KeyboardEvent) => void;
  handle_keydown: (event: KeyboardEvent) => void;
};

export function use_keyboard_shortcuts(input: {
  is_enabled: () => boolean;
  is_blocked: () => boolean;
  is_omnibar_open: () => boolean;
  on_toggle_omnibar: () => void;
  on_open_omnibar_commands: () => void;
  on_open_omnibar_notes: () => void;
  on_select_pinned_vault: (slot: number) => void;
  on_toggle_sidebar: () => void;
  on_toggle_find_in_file: () => void;
  on_save: () => void;
}): KeyboardShortcuts {
  const {
    is_enabled,
    is_blocked,
    is_omnibar_open,
    on_toggle_omnibar,
    on_open_omnibar_commands,
    on_open_omnibar_notes,
    on_select_pinned_vault,
    on_toggle_sidebar,
    on_toggle_find_in_file,
    on_save,
  } = input;

  const is_mod_combo = (event: KeyboardEvent, key: string): boolean => {
    if (!(event.metaKey || event.ctrlKey)) return false;
    return event.key.toLowerCase() === key;
  };

  const mod_slot = (event: KeyboardEvent): number | null => {
    if (!(event.metaKey || event.ctrlKey)) return null;
    if (event.altKey || event.shiftKey) return null;
    if (event.key < "1" || event.key > "5") return null;
    return Number(event.key) - 1;
  };

  const handle_keydown_capture = (event: KeyboardEvent) => {
    const slot = mod_slot(event);
    if (slot !== null) {
      if (!is_enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      if (is_blocked()) return;
      on_select_pinned_vault(slot);
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
      if (is_blocked()) return;
      on_toggle_find_in_file();
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
