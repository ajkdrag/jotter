import type { HotkeyConfig } from "$lib/types/hotkey_config";
import type { ActionRegistry } from "$lib/actions/registry";
import { normalize_event_to_key } from "$lib/domain/hotkey_validation";

export type KeyboardShortcuts = {
  handle_keydown_capture: (event: KeyboardEvent) => void;
  handle_keydown: (event: KeyboardEvent) => void;
};

export function use_keyboard_shortcuts(input: {
  hotkeys_config: () => HotkeyConfig;
  is_enabled: () => boolean;
  is_blocked: () => boolean;
  is_omnibar_open: () => boolean;
  is_vault_switcher_open: () => boolean;
  has_tabs: () => boolean;
  action_registry: ActionRegistry;
  on_close_vault_switcher: () => void;
  on_select_pinned_vault: (slot: number) => void;
  on_switch_to_tab: (index: number) => void;
}): KeyboardShortcuts {
  const {
    hotkeys_config,
    is_enabled,
    is_blocked,
    is_omnibar_open,
    is_vault_switcher_open,
    has_tabs,
    action_registry,
    on_close_vault_switcher,
    on_select_pinned_vault,
    on_switch_to_tab,
  } = input;

  const build_key_maps = () => {
    const config = hotkeys_config();
    const capture_map = new Map<string, string>();
    const bubble_map = new Map<string, string>();

    for (const binding of config.bindings) {
      if (binding.key === null) continue;
      const target_map = binding.phase === "capture" ? capture_map : bubble_map;
      target_map.set(binding.key, binding.action_id);
    }

    return { capture_map, bubble_map };
  };

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
    if (is_mod_combo(event, "w") && is_vault_switcher_open()) {
      event.preventDefault();
      event.stopPropagation();
      on_close_vault_switcher();
      return;
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

    if (!is_enabled()) return;

    const { capture_map } = build_key_maps();
    const key = normalize_event_to_key(event);
    const action_id = capture_map.get(key);

    if (action_id) {
      event.preventDefault();
      event.stopPropagation();

      if (is_blocked() && !is_omnibar_open()) return;

      void action_registry.execute(action_id);
    }
  };

  const handle_keydown = (event: KeyboardEvent) => {
    if (!is_enabled()) return;

    const { bubble_map } = build_key_maps();
    const key = normalize_event_to_key(event);
    const action_id = bubble_map.get(key);

    if (action_id) {
      event.preventDefault();
      event.stopPropagation();

      if (is_blocked()) return;

      void action_registry.execute(action_id);
    }
  };

  return {
    handle_keydown_capture,
    handle_keydown,
  };
}
