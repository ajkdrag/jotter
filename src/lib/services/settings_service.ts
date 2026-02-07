import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { SettingsLoadResult, SettingsSaveResult } from '$lib/types/settings_service_result'
import { SETTINGS_KEY } from '$lib/types/editor_settings'
import { error_message } from '$lib/utils/error_message'
import { logger } from '$lib/utils/logger'

export class SettingsService {
  constructor(
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly vault_store: VaultStore,
    private readonly op_store: OpStore
  ) {}

  async load_settings(current_settings: EditorSettings): Promise<SettingsLoadResult> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return {
        status: 'skipped',
        settings: current_settings
      }
    }

    this.op_store.start('settings.load')

    try {
      const stored = await this.vault_settings_port.get_vault_setting<EditorSettings>(vault_id, SETTINGS_KEY)
      const settings = stored ? { ...current_settings, ...stored } : { ...current_settings }
      this.op_store.succeed('settings.load')
      return {
        status: 'success',
        settings
      }
    } catch (error) {
      const message = error_message(error)
      logger.error(`Load settings failed: ${message}`)
      this.op_store.fail('settings.load', message)
      return {
        status: 'failed',
        settings: current_settings,
        error: message
      }
    }
  }

  async save_settings(settings: EditorSettings): Promise<SettingsSaveResult> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return { status: 'skipped' }
    }

    this.op_store.start('settings.save')

    try {
      await this.vault_settings_port.set_vault_setting(vault_id, SETTINGS_KEY, settings)
      this.op_store.succeed('settings.save')
      return { status: 'success' }
    } catch (error) {
      const message = error_message(error)
      logger.error(`Save settings failed: ${message}`)
      this.op_store.fail('settings.save', message)
      return {
        status: 'failed',
        error: message
      }
    }
  }
}
