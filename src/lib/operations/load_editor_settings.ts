import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { EditorSettings } from "$lib/types/editor_settings";
import type { VaultId } from "$lib/types/ids";
import {
  DEFAULT_EDITOR_SETTINGS,
  SETTINGS_KEY,
} from "$lib/types/editor_settings";

export async function load_editor_settings(
  vault_settings_port: VaultSettingsPort,
  vault_id: VaultId,
  legacy_settings_port?: SettingsPort,
): Promise<EditorSettings> {
  const stored = await vault_settings_port.get_vault_setting<EditorSettings>(vault_id, SETTINGS_KEY);

  if (stored) {
    return { ...DEFAULT_EDITOR_SETTINGS, ...stored };
  }

  if (legacy_settings_port) {
    const legacy = await legacy_settings_port.get_setting<EditorSettings>(SETTINGS_KEY);
    if (legacy) {
      const migrated = { ...DEFAULT_EDITOR_SETTINGS, ...legacy };
      await vault_settings_port.set_vault_setting(vault_id, SETTINGS_KEY, migrated);
      return migrated;
    }
  }

  return DEFAULT_EDITOR_SETTINGS;
}

export async function save_editor_settings(
  vault_settings_port: VaultSettingsPort,
  vault_id: VaultId,
  settings: EditorSettings,
): Promise<void> {
  await vault_settings_port.set_vault_setting(vault_id, SETTINGS_KEY, settings);
}
