import type { VaultPort } from '$lib/ports/vault_port'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { ThemePort } from '$lib/ports/theme_port'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { NotesStore } from '$lib/stores/notes_store.svelte'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import { DEFAULT_EDITOR_SETTINGS, SETTINGS_KEY, type EditorSettings } from '$lib/types/editor_settings'
import { ensure_open_note } from '$lib/utils/ensure_open_note'
import { error_message } from '$lib/utils/error_message'
import { logger } from '$lib/utils/logger'

export type AppMountConfig = {
  reset_app_state: boolean
  bootstrap_default_vault_path: VaultPath | null
}

export class VaultService {
  constructor(
    private readonly vault_port: VaultPort,
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly settings_port: SettingsPort,
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly theme_port: ThemePort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly ui_store: UIStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number
  ) {}

  async initialize(config: AppMountConfig): Promise<void> {
    this.op_store.start('app.startup')
    this.ui_store.startup = {
      status: 'loading',
      error: null
    }

    try {
      this.ui_store.set_theme(this.theme_port.get_theme())

      if (config.reset_app_state) {
        this.reset_app_state()
      }

      const has_vault = this.vault_store.vault !== null

      if (!has_vault && config.bootstrap_default_vault_path) {
        await this.open_vault_by_path(config.bootstrap_default_vault_path)
      } else {
        const recent_vaults = await this.vault_port.list_vaults()
        this.vault_store.set_recent_vaults(recent_vaults)
      }

      this.ui_store.startup = {
        status: 'idle',
        error: null
      }
      this.op_store.succeed('app.startup')
    } catch (error) {
      const message = error_message(error)
      logger.error(`App startup failed: ${message}`)
      this.ui_store.startup = {
        status: 'error',
        error: message
      }
      this.op_store.fail('app.startup', message)
    }
  }

  open_change_vault_dialog() {
    this.ui_store.change_vault = {
      ...this.ui_store.change_vault,
      open: true,
      error: null
    }
  }

  close_change_vault_dialog() {
    this.ui_store.change_vault = {
      ...this.ui_store.change_vault,
      open: false,
      error: null
    }
    this.op_store.reset('vault.change')
  }

  async choose_vault(): Promise<void> {
    this.ui_store.change_vault = {
      ...this.ui_store.change_vault,
      is_loading: true,
      error: null
    }
    this.op_store.start('vault.change')

    try {
      this.ui_store.set_system_dialog_open(true)
      const vault_path = await this.vault_port.choose_vault()
      this.ui_store.set_system_dialog_open(false)

      if (!vault_path) {
        this.ui_store.change_vault = {
          ...this.ui_store.change_vault,
          is_loading: false
        }
        this.op_store.reset('vault.change')
        return
      }

      await this.open_vault_by_path(vault_path)

      this.ui_store.change_vault = {
        open: false,
        is_loading: false,
        error: null
      }
      this.op_store.succeed('vault.change')
    } catch (error) {
      this.ui_store.set_system_dialog_open(false)
      const message = error_message(error)
      logger.error(`Choose vault failed: ${message}`)
      this.ui_store.change_vault = {
        ...this.ui_store.change_vault,
        is_loading: false,
        error: message
      }
      this.op_store.fail('vault.change', message)
    }
  }

  async select_vault(vault_id: VaultId): Promise<void> {
    this.ui_store.change_vault = {
      ...this.ui_store.change_vault,
      is_loading: true,
      error: null
    }
    this.op_store.start('vault.change')

    try {
      await this.open_vault_by_id(vault_id)
      this.ui_store.change_vault = {
        open: false,
        is_loading: false,
        error: null
      }
      this.op_store.succeed('vault.change')
    } catch (error) {
      const message = error_message(error)
      logger.error(`Select vault failed: ${message}`)
      this.ui_store.change_vault = {
        ...this.ui_store.change_vault,
        is_loading: false,
        error: message
      }
      this.op_store.fail('vault.change', message)
    }
  }

  set_theme(theme: 'light' | 'dark' | 'system') {
    this.op_store.start('theme.set')

    try {
      this.theme_port.set_theme(theme)
      this.ui_store.set_theme(theme)
      this.op_store.succeed('theme.set')
    } catch (error) {
      logger.error(`Set theme failed: ${error_message(error)}`)
      this.op_store.fail('theme.set', error_message(error))
      throw error
    }
  }

  private async open_vault_by_path(vault_path: VaultPath): Promise<void> {
    const vault = await this.vault_port.open_vault(vault_path)
    await this.finish_open_vault(vault)
  }

  private async open_vault_by_id(vault_id: VaultId): Promise<void> {
    const vault = await this.vault_port.open_vault_by_id(vault_id)
    await this.finish_open_vault(vault)
  }

  private async finish_open_vault(vault: Vault): Promise<void> {
    await this.vault_port.remember_last_vault(vault.id)

    const [notes, folder_paths, recent_vaults] = await Promise.all([
      this.notes_port.list_notes(vault.id),
      this.notes_port.list_folders(vault.id),
      this.vault_port.list_vaults()
    ])

    await this.index_port.build_index(vault.id)

    this.vault_store.clear()
    this.notes_store.reset()
    this.editor_store.reset()

    this.vault_store.set_vault(vault)
    this.notes_store.set_notes(notes)
    this.notes_store.set_folder_paths(folder_paths)
    this.vault_store.set_recent_vaults(recent_vaults)

    const ensured_note = ensure_open_note({
      vault,
      notes,
      open_note: null,
      now_ms: this.now_ms()
    })

    if (ensured_note) {
      this.editor_store.set_open_note(ensured_note)
    }

    this.ui_store.reset_for_new_vault()
    this.ui_store.change_vault = {
      ...this.ui_store.change_vault,
      open: false,
      error: null,
      is_loading: false
    }

    const settings = await this.load_editor_settings(vault.id)
    this.ui_store.set_editor_settings(settings)
  }

  private async load_editor_settings(vault_id: VaultId): Promise<EditorSettings> {
    const stored = await this.vault_settings_port.get_vault_setting<EditorSettings>(vault_id, SETTINGS_KEY)
    if (stored) {
      return { ...DEFAULT_EDITOR_SETTINGS, ...stored }
    }

    const legacy = await this.settings_port.get_setting<EditorSettings>(SETTINGS_KEY)
    if (legacy) {
      const migrated = { ...DEFAULT_EDITOR_SETTINGS, ...legacy }
      await this.vault_settings_port.set_vault_setting(vault_id, SETTINGS_KEY, migrated)
      return migrated
    }

    return { ...DEFAULT_EDITOR_SETTINGS }
  }

  private reset_app_state() {
    this.vault_store.reset()
    this.notes_store.reset()
    this.editor_store.reset()
    this.ui_store.reset_for_new_vault()
    this.ui_store.set_theme('system')
    this.ui_store.set_editor_settings({ ...DEFAULT_EDITOR_SETTINGS })
    this.op_store.reset_all()
  }
}
