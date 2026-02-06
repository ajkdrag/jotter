import type { SettingsPort } from '$lib/ports/settings_port'
import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { VaultId } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'
import { DEFAULT_EDITOR_SETTINGS, SETTINGS_KEY } from '$lib/types/editor_settings'
import type { EditorSettings } from '$lib/types/editor_settings'

export async function load_editor_settings_use_case(
  ports: { vault_settings: VaultSettingsPort; settings: SettingsPort | undefined },
  args: { vault_id: VaultId }
): Promise<AppEvent[]> {
  const stored = await ports.vault_settings.get_vault_setting<EditorSettings>(
    args.vault_id,
    SETTINGS_KEY
  )

  if (stored) {
    return [{ type: 'ui_editor_settings_set', settings: { ...DEFAULT_EDITOR_SETTINGS, ...stored } }]
  }

  if (ports.settings) {
    const legacy = await ports.settings.get_setting<EditorSettings>(SETTINGS_KEY)
    if (legacy) {
      const migrated = { ...DEFAULT_EDITOR_SETTINGS, ...legacy }
      await ports.vault_settings.set_vault_setting(args.vault_id, SETTINGS_KEY, migrated)
      return [{ type: 'ui_editor_settings_set', settings: migrated }]
    }
  }

  return [{ type: 'ui_editor_settings_set', settings: DEFAULT_EDITOR_SETTINGS }]
}
