import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { VaultId } from '$lib/types/ids'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { AppEvent } from '$lib/events/app_event'
import { SETTINGS_KEY } from '$lib/types/editor_settings'

export async function save_editor_settings_use_case(
  ports: { vault_settings: VaultSettingsPort },
  args: { vault_id: VaultId; settings: EditorSettings }
): Promise<AppEvent[]> {
  await ports.vault_settings.set_vault_setting(args.vault_id, SETTINGS_KEY, args.settings)
  return [{ type: 'ui_editor_settings_set', settings: args.settings }]
}
