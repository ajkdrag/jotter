import type { SettingsPort } from "$lib/ports/settings_port";
import type { EditorSettings } from "$lib/types/editor_settings";
import {
  DEFAULT_EDITOR_SETTINGS,
  SETTINGS_KEY,
} from "$lib/types/editor_settings";

export async function load_editor_settings(
  settings_port: SettingsPort,
): Promise<EditorSettings> {
  const stored = await settings_port.get_setting<EditorSettings>(SETTINGS_KEY);
  if (!stored) return DEFAULT_EDITOR_SETTINGS
  return { ...DEFAULT_EDITOR_SETTINGS, ...stored }
}

export async function save_editor_settings(
  settings_port: SettingsPort,
  settings: EditorSettings,
): Promise<void> {
  await settings_port.set_setting(SETTINGS_KEY, settings);
}
