import { ActionRegistry } from '$lib/actions/registry'
import { ACTION_IDS } from '$lib/actions/action_ids'
import type { NoteMeta } from '$lib/types/note'
import type { NoteId, VaultId } from '$lib/types/ids'
import type { ThemeMode } from '$lib/types/theme'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { CommandId } from '$lib/types/command_palette'
import type { OpenNoteState } from '$lib/types/editor'
import type { AppMountConfig } from '$lib/services/vault_service'
import type { VaultService } from '$lib/services/vault_service'
import type { NoteService } from '$lib/services/note_service'
import type { FolderService } from '$lib/services/folder_service'
import type { SettingsService } from '$lib/services/settings_service'
import type { SearchService } from '$lib/services/search_service'
import type { EditorService } from '$lib/services/editor_service'
import type { ClipboardService } from '$lib/services/clipboard_service'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { VaultStore } from '$lib/stores/vault_store.svelte'

export type ActionRegistrationInput = {
  registry: ActionRegistry
  stores: {
    ui: UIStore
    vault: VaultStore
  }
  services: {
    vault: VaultService
    note: NoteService
    folder: FolderService
    settings: SettingsService
    search: SearchService
    editor: EditorService
    clipboard: ClipboardService
  }
  default_mount_config: AppMountConfig
}

export function register_actions(input: ActionRegistrationInput) {
  const { registry, stores, services, default_mount_config } = input

  registry.register({
    id: ACTION_IDS.app_mounted,
    label: 'App Mounted',
    execute: async () => {
      await services.vault.initialize(default_mount_config)
    }
  })

  registry.register({
    id: ACTION_IDS.app_editor_mount,
    label: 'Editor Mount',
    execute: async (
      root: unknown,
      note: unknown,
      link_syntax: unknown,
      on_wiki_link_click: unknown
    ) => {
      await services.editor.mount({
        root: root as HTMLDivElement,
        note: note as OpenNoteState,
        link_syntax: link_syntax as EditorSettings['link_syntax'],
        on_wiki_link_click: on_wiki_link_click as (note_path: string) => void
      })
    }
  })

  registry.register({
    id: ACTION_IDS.app_editor_unmount,
    label: 'Editor Unmount',
    execute: () => {
      services.editor.unmount()
    }
  })

  registry.register({
    id: ACTION_IDS.note_create,
    label: 'Create Note',
    shortcut: 'CmdOrCtrl+N',
    when: () => stores.vault.vault !== null,
    execute: (folder_prefix?: unknown) => {
      services.note.create_new_note(folder_prefix as string | undefined)
    }
  })

  registry.register({
    id: ACTION_IDS.note_open,
    label: 'Open Note',
    when: () => stores.vault.vault !== null,
    execute: async (note_path: unknown) => {
      await services.note.open_note(String(note_path), false)
    }
  })

  registry.register({
    id: ACTION_IDS.note_open_wiki_link,
    label: 'Open Wiki Link',
    when: () => stores.vault.vault !== null,
    execute: async (note_path: unknown) => {
      await services.note.open_wiki_link(String(note_path))
    }
  })

  registry.register({
    id: ACTION_IDS.note_copy_markdown,
    label: 'Copy Markdown',
    execute: async () => {
      await services.clipboard.copy_open_note_markdown()
    }
  })

  registry.register({
    id: ACTION_IDS.note_request_delete,
    label: 'Request Delete Note',
    execute: (note: unknown) => {
      services.note.request_delete(note as NoteMeta)
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_delete,
    label: 'Confirm Delete Note',
    execute: async () => {
      await services.note.confirm_delete()
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_delete,
    label: 'Cancel Delete Note',
    execute: () => {
      services.note.cancel_delete()
    }
  })

  registry.register({
    id: ACTION_IDS.note_request_rename,
    label: 'Request Rename Note',
    execute: (note: unknown) => {
      services.note.request_rename(note as NoteMeta)
    }
  })

  registry.register({
    id: ACTION_IDS.note_update_rename_path,
    label: 'Update Rename Note Path',
    execute: (path: unknown) => {
      services.note.update_rename_path(String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_rename,
    label: 'Confirm Rename Note',
    execute: async () => {
      await services.note.confirm_rename()
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_rename_overwrite,
    label: 'Confirm Rename Note Overwrite',
    execute: async () => {
      await services.note.confirm_rename_overwrite()
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_rename,
    label: 'Cancel Rename Note',
    execute: () => {
      services.note.cancel_rename()
    }
  })

  registry.register({
    id: ACTION_IDS.note_retry_rename,
    label: 'Retry Rename Note',
    execute: async () => {
      await services.note.retry_rename()
    }
  })

  registry.register({
    id: ACTION_IDS.note_request_save,
    label: 'Save Note',
    shortcut: 'CmdOrCtrl+S',
    when: () => stores.vault.vault !== null,
    execute: () => {
      services.note.request_save()
    }
  })

  registry.register({
    id: ACTION_IDS.note_update_save_path,
    label: 'Update Save Note Path',
    execute: (path: unknown) => {
      services.note.update_save_path(String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_save,
    label: 'Confirm Save Note',
    execute: async () => {
      await services.note.confirm_save()
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_save_overwrite,
    label: 'Confirm Save Note Overwrite',
    execute: async () => {
      await services.note.confirm_save_overwrite()
    }
  })

  registry.register({
    id: ACTION_IDS.note_retry_save,
    label: 'Retry Save Note',
    execute: async () => {
      await services.note.retry_save()
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_save,
    label: 'Cancel Save Note',
    execute: () => {
      services.note.cancel_save()
    }
  })

  registry.register({
    id: ACTION_IDS.vault_request_change,
    label: 'Request Change Vault',
    execute: () => {
      services.vault.open_change_vault_dialog()
    }
  })

  registry.register({
    id: ACTION_IDS.vault_close_change,
    label: 'Close Change Vault Dialog',
    execute: () => {
      services.vault.close_change_vault_dialog()
    }
  })

  registry.register({
    id: ACTION_IDS.vault_choose,
    label: 'Choose Vault',
    execute: async () => {
      await services.vault.choose_vault()
    }
  })

  registry.register({
    id: ACTION_IDS.vault_select,
    label: 'Select Vault',
    execute: async (vault_id: unknown) => {
      await services.vault.select_vault(vault_id as VaultId)
    }
  })

  registry.register({
    id: ACTION_IDS.folder_request_create,
    label: 'Request Create Folder',
    execute: (parent_path: unknown) => {
      services.folder.request_create(String(parent_path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_update_create_name,
    label: 'Update Create Folder Name',
    execute: (name: unknown) => {
      services.folder.update_create_name(String(name))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_confirm_create,
    label: 'Confirm Create Folder',
    execute: async () => {
      await services.folder.confirm_create()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_cancel_create,
    label: 'Cancel Create Folder',
    execute: () => {
      services.folder.cancel_create()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_toggle,
    label: 'Toggle Folder',
    execute: async (path: unknown) => {
      await services.folder.toggle_folder(String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_retry_load,
    label: 'Retry Folder Load',
    execute: async (path: unknown) => {
      await services.folder.retry_load(String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_collapse_all,
    label: 'Collapse All Folders',
    execute: () => {
      services.folder.collapse_all_folders()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_refresh_tree,
    label: 'Refresh File Tree',
    execute: async () => {
      await services.folder.refresh_filetree()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_request_delete,
    label: 'Request Delete Folder',
    execute: async (folder_path: unknown) => {
      await services.folder.request_delete(String(folder_path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_confirm_delete,
    label: 'Confirm Delete Folder',
    execute: async () => {
      await services.folder.confirm_delete()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_cancel_delete,
    label: 'Cancel Delete Folder',
    execute: () => {
      services.folder.cancel_delete()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_retry_delete,
    label: 'Retry Delete Folder',
    execute: async () => {
      await services.folder.retry_delete()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_request_rename,
    label: 'Request Rename Folder',
    execute: (folder_path: unknown) => {
      services.folder.request_rename(String(folder_path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_update_rename_path,
    label: 'Update Rename Folder Path',
    execute: (path: unknown) => {
      services.folder.update_rename_path(String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_confirm_rename,
    label: 'Confirm Rename Folder',
    execute: async () => {
      await services.folder.confirm_rename()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_cancel_rename,
    label: 'Cancel Rename Folder',
    execute: () => {
      services.folder.cancel_rename()
    }
  })

  registry.register({
    id: ACTION_IDS.folder_retry_rename,
    label: 'Retry Rename Folder',
    execute: async () => {
      await services.folder.retry_rename()
    }
  })

  registry.register({
    id: ACTION_IDS.ui_toggle_sidebar,
    label: 'Toggle Sidebar',
    shortcut: 'CmdOrCtrl+B',
    execute: () => {
      stores.ui.toggle_sidebar()
    }
  })

  registry.register({
    id: ACTION_IDS.ui_select_folder,
    label: 'Select Folder',
    execute: (path: unknown) => {
      stores.ui.set_selected_folder_path(String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.ui_set_theme,
    label: 'Set Theme',
    execute: (theme: unknown) => {
      services.vault.set_theme(theme as ThemeMode)
    }
  })

  registry.register({
    id: ACTION_IDS.settings_open,
    label: 'Open Settings',
    execute: async () => {
      await services.settings.open_dialog()
    }
  })

  registry.register({
    id: ACTION_IDS.settings_close,
    label: 'Close Settings',
    execute: () => {
      services.settings.close_dialog()
    }
  })

  registry.register({
    id: ACTION_IDS.settings_update,
    label: 'Update Settings',
    execute: (settings: unknown) => {
      services.settings.update_settings(settings as EditorSettings)
    }
  })

  registry.register({
    id: ACTION_IDS.settings_save,
    label: 'Save Settings',
    execute: async () => {
      await services.settings.save_settings()
    }
  })

  registry.register({
    id: ACTION_IDS.palette_toggle,
    label: 'Toggle Command Palette',
    shortcut: 'CmdOrCtrl+P',
    execute: () => {
      services.search.toggle_command_palette()
    }
  })

  registry.register({
    id: ACTION_IDS.palette_open,
    label: 'Open Command Palette',
    execute: () => {
      services.search.open_command_palette()
    }
  })

  registry.register({
    id: ACTION_IDS.palette_close,
    label: 'Close Command Palette',
    execute: () => {
      services.search.close_command_palette()
    }
  })

  registry.register({
    id: ACTION_IDS.palette_set_query,
    label: 'Set Command Palette Query',
    execute: (query: unknown) => {
      services.search.set_command_palette_query(String(query))
    }
  })

  registry.register({
    id: ACTION_IDS.palette_set_selected_index,
    label: 'Set Command Palette Selected Index',
    execute: (index: unknown) => {
      services.search.set_command_palette_selected_index(Number(index))
    }
  })

  registry.register({
    id: ACTION_IDS.palette_select_command,
    label: 'Select Command Palette Command',
    execute: async (command: unknown) => {
      const command_id = command as CommandId
      services.search.select_command_palette_command(command_id)

      switch (command_id) {
        case 'create_new_note':
          await registry.execute(ACTION_IDS.note_create)
          break
        case 'change_vault':
          await registry.execute(ACTION_IDS.vault_request_change)
          break
        case 'open_settings':
          await registry.execute(ACTION_IDS.settings_open)
          break
        case 'open_file_search':
          await registry.execute(ACTION_IDS.search_open)
          break
      }
    }
  })

  registry.register({
    id: ACTION_IDS.palette_select_setting,
    label: 'Select Command Palette Setting',
    execute: async (key: unknown) => {
      services.search.select_command_palette_setting(String(key))
      await registry.execute(ACTION_IDS.settings_open)
    }
  })

  registry.register({
    id: ACTION_IDS.search_toggle,
    label: 'Toggle File Search',
    shortcut: 'CmdOrCtrl+O',
    execute: () => {
      services.search.toggle_file_search()
    }
  })

  registry.register({
    id: ACTION_IDS.search_open,
    label: 'Open File Search',
    execute: () => {
      services.search.open_file_search()
    }
  })

  registry.register({
    id: ACTION_IDS.search_close,
    label: 'Close File Search',
    execute: () => {
      services.search.close_file_search()
    }
  })

  registry.register({
    id: ACTION_IDS.search_set_query,
    label: 'Set File Search Query',
    execute: async (query: unknown) => {
      await services.search.set_file_search_query(String(query))
    }
  })

  registry.register({
    id: ACTION_IDS.search_set_selected_index,
    label: 'Set File Search Selected Index',
    execute: (index: unknown) => {
      services.search.set_file_search_selected_index(Number(index))
    }
  })

  registry.register({
    id: ACTION_IDS.search_confirm_note,
    label: 'Confirm File Search Note',
    execute: async (note_id: unknown) => {
      const selected_note_id = note_id as NoteId
      services.search.confirm_file_search_note(selected_note_id)
      await registry.execute(ACTION_IDS.note_open, selected_note_id)
    }
  })
}
