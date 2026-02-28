export { register_hotkey_actions } from "$lib/features/hotkey/application/hotkey_actions";
export { HotkeyService } from "$lib/features/hotkey/application/hotkey_service";
export { DEFAULT_HOTKEYS } from "$lib/features/hotkey/domain/default_hotkeys";
export {
  RESERVED_KEYS,
  format_hotkey_for_display,
  normalize_event_to_key,
  is_reserved_key,
  is_valid_hotkey,
  parse_hotkey_parts,
} from "$lib/features/hotkey/domain/hotkey_validation";
export { default as HotkeyKey } from "$lib/features/hotkey/ui/hotkey_key.svelte";
export { default as HotkeysPanel } from "$lib/features/hotkey/ui/hotkeys_panel.svelte";
export { default as HotkeyRecorderDialog } from "$lib/features/hotkey/ui/hotkey_recorder_dialog.svelte";
export type {
  HotkeyBinding,
  HotkeyCategory,
  HotkeyConfig,
  HotkeyConflict,
  HotkeyKey as HotkeyKeyType,
  HotkeyOverride,
  HotkeyPhase,
  HotkeyRecorderState,
} from "$lib/features/hotkey/types/hotkey_config";
