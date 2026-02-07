import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { EditorSettings } from '$lib/types/editor_settings'
import { SETTINGS_KEY } from '$lib/types/editor_settings'
import { error_message } from '$lib/utils/error_message'
import { logger } from '$lib/utils/logger'

export class SettingsService {
  constructor(
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly vault_store: VaultStore,
    private readonly ui_store: UIStore,
    private readonly op_store: OpStore
  ) {}

  async open_dialog(): Promise<void> {
    const vault_id = this.vault_store.vault?.id

    this.ui_store.settings_dialog = {
      open: true,
      current_settings: { ...this.ui_store.editor_settings },
      has_unsaved_changes: false
    }

    if (!vault_id) return

    this.op_store.start('settings.load')

    try {
      const stored = await this.vault_settings_port.get_vault_setting<EditorSettings>(vault_id, SETTINGS_KEY)
      const settings = stored ? { ...this.ui_store.editor_settings, ...stored } : { ...this.ui_store.editor_settings }

      this.ui_store.settings_dialog = {
        ...this.ui_store.settings_dialog,
        current_settings: settings,
        has_unsaved_changes: false
      }
      this.ui_store.set_editor_settings(settings)
      this.op_store.succeed('settings.load')
    } catch (error) {
      logger.error(`Load settings failed: ${error_message(error)}`)
      this.op_store.fail('settings.load', error_message(error))
    }
  }

  close_dialog() {
    this.ui_store.settings_dialog = {
      ...this.ui_store.settings_dialog,
      open: false,
      has_unsaved_changes: false
    }
    this.op_store.reset('settings.load')
    this.op_store.reset('settings.save')
  }

  update_settings(settings: EditorSettings) {
    this.ui_store.settings_dialog = {
      ...this.ui_store.settings_dialog,
      current_settings: settings,
      has_unsaved_changes: true
    }
    this.ui_store.set_editor_settings(settings)
  }

  async save_settings(): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) return

    this.op_store.start('settings.save')

    try {
      const settings = this.ui_store.settings_dialog.current_settings
      await this.vault_settings_port.set_vault_setting(vault_id, SETTINGS_KEY, settings)
      this.ui_store.set_editor_settings(settings)
      this.ui_store.settings_dialog = {
        ...this.ui_store.settings_dialog,
        has_unsaved_changes: false
      }
      this.op_store.succeed('settings.save')
    } catch (error) {
      logger.error(`Save settings failed: ${error_message(error)}`)
      this.op_store.fail('settings.save', error_message(error))
    }
  }
}
