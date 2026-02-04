import type { AppFlows } from '$lib/flows/create_app_flows'
import type { VaultId, VaultPath } from '$lib/types/ids'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import { parent_folder_path } from '$lib/utils/filetree'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { ThemeMode } from '$lib/types/theme'
import type { ImagePasteData } from '$lib/types/image_paste'

export type AppShellActionsConfig = {
  bootstrap_default_vault_path?: VaultPath
  reset_state_on_mount: boolean
}

export type AppShellActions = {
  mount: () => void

  create_new_note: () => void

  request_change_vault: () => void
  close_change_vault_dialog: () => void
  choose_vault_dir: () => void
  select_vault: (vault_id: VaultId) => void

  open_note: (note_path: string) => void
  open_wiki_link: (note_path: string) => void
  markdown_change: (markdown: string) => void
  dirty_state_change: (is_dirty: boolean) => void
  handle_image_paste: (data: ImagePasteData) => void
  copy_open_note_markdown: () => void

  request_delete: (note: NoteMeta) => void
  confirm_delete: () => void
  cancel_delete: () => void
  retry_delete: () => void

  request_rename: (note: NoteMeta) => void
  update_rename_path: (path: string) => void
  confirm_rename: () => void
  confirm_rename_overwrite: () => void
  cancel_rename: () => void
  retry_rename: () => void

  request_save: () => void
  update_save_path: (path: string) => void
  confirm_save: () => void
  confirm_save_overwrite: () => void
  retry_save: () => void
  cancel_save: () => void

  update_image_paste_name: (name: string) => void
  confirm_image_paste: () => void
  cancel_image_paste: () => void
  retry_image_paste: () => void

  open_settings: () => void
  close_settings: () => void
  update_settings: (new_settings: EditorSettings) => void
  save_settings: () => void

  handle_theme_change: (theme: ThemeMode) => void

  request_create_folder: (parent_path: string) => void
  confirm_create_folder: () => void
  cancel_create_folder: () => void
  update_create_folder_name: (name: string) => void

  toggle_sidebar: () => void
  select_folder_path: (path: string) => void

  toggle_filetree_folder: (path: string) => void
  retry_load_folder: (path: string) => void
  collapse_all_folders: () => void

  request_delete_folder: (folder_path: string) => void
  request_rename_folder: (folder_path: string) => void
}

export function create_app_shell_actions(input: {
  config: AppShellActionsConfig
  app: AppFlows
}): AppShellActions {
  const { config, app } = input

  return {
    mount: () => {
      app.flows.preferences_initialization.send({ type: 'INITIALIZE' })

      app.flows.vault_bootstrap.send({
        type: 'START',
        config: {
          reset_app_state: config.reset_state_on_mount,
          bootstrap_default_vault_path: config.bootstrap_default_vault_path ?? null
        }
      })
    },

    create_new_note: () => {
      const notes = app.stores.notes.get_snapshot().notes
      const selected_folder_path = app.stores.ui.get_snapshot().selected_folder_path
      app.stores.editor.actions.create_new_note_in_folder(notes, selected_folder_path, app.stores.now_ms())
    },

    request_change_vault: () => {
      app.flows.change_vault.send({ type: 'OPEN_DIALOG' })
    },

    close_change_vault_dialog: () => {
      app.flows.change_vault.send({ type: 'CLOSE_DIALOG' })
    },

    choose_vault_dir: () => {
      app.flows.change_vault.send({ type: 'CHOOSE_VAULT' })
    },

    select_vault: (vault_id) => {
      app.flows.change_vault.send({ type: 'SELECT_VAULT', vault_id })
    },

    open_note: (note_path) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      if (!vault_id) return

      const normalized_path = as_note_path(note_path)
      app.stores.ui.actions.set_selected_folder_path(parent_folder_path(normalized_path))

      const current_note_id = app.stores.editor.get_snapshot().open_note?.meta.id
      if (current_note_id && current_note_id === normalized_path) return

      app.flows.open_note.send({ type: 'OPEN_NOTE', vault_id, note_path: normalized_path })
    },

    open_wiki_link: (note_path) => {
      const vault = app.stores.vault.get_snapshot().vault
      if (!vault) return

      const normalized_path = as_note_path(note_path)

      const current_note_id = app.stores.editor.get_snapshot().open_note?.meta.id
      if (current_note_id && current_note_id === normalized_path) return

      app.flows.open_note.send({ type: 'OPEN_WIKI_LINK', vault_id: vault.id, note_path: normalized_path })
    },

    markdown_change: (markdown) => {
      app.stores.editor.actions.update_markdown(as_markdown_text(markdown))
    },

    dirty_state_change: (is_dirty) => {
      app.stores.editor.actions.update_dirty_state(is_dirty)
    },

    handle_image_paste: (data) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      const open_note = app.stores.editor.get_snapshot().open_note
      if (!vault_id || !open_note) return

      const attachments_folder = app.stores.ui.get_snapshot().editor_settings.attachments_folder

      app.flows.image_paste.send({
        type: 'REQUEST_PASTE',
        data,
        vault_id,
        note_id: open_note.meta.id,
        attachments_folder
      })
    },

    copy_open_note_markdown: () => {
      const open_note = app.stores.editor.get_snapshot().open_note
      if (!open_note) return

      app.flows.clipboard.send({ type: 'COPY_TEXT', text: open_note.markdown })
    },

    request_delete: (note) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      if (!vault_id) return

      const is_note_currently_open = app.stores.editor.get_snapshot().open_note?.meta.id === note.id
      app.flows.delete_note.send({ type: 'REQUEST_DELETE', vault_id, note, is_note_currently_open })
    },

    confirm_delete: () => {
      app.flows.delete_note.send({ type: 'CONFIRM' })
    },

    cancel_delete: () => {
      app.flows.delete_note.send({ type: 'CANCEL' })
    },

    retry_delete: () => {
      app.flows.delete_note.send({ type: 'RETRY' })
    },

    request_rename: (note) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      if (!vault_id) return

      const is_note_currently_open = app.stores.editor.get_snapshot().open_note?.meta.id === note.id
      app.flows.rename_note.send({ type: 'REQUEST_RENAME', vault_id, note, is_note_currently_open })
    },

    update_rename_path: (path) => {
      app.flows.rename_note.send({ type: 'UPDATE_NEW_PATH', path: as_note_path(path) })
    },

    confirm_rename: () => {
      app.flows.rename_note.send({ type: 'CONFIRM' })
    },

    confirm_rename_overwrite: () => {
      app.flows.rename_note.send({ type: 'CONFIRM_OVERWRITE' })
    },

    cancel_rename: () => {
      app.flows.rename_note.send({ type: 'CANCEL' })
    },

    retry_rename: () => {
      app.flows.rename_note.send({ type: 'RETRY' })
    },

    request_save: () => {
      app.flows.save_note.send({ type: 'REQUEST_SAVE' })
    },

    update_save_path: (path) => {
      app.flows.save_note.send({ type: 'UPDATE_NEW_PATH', path: as_note_path(path) })
    },

    confirm_save: () => {
      app.flows.save_note.send({ type: 'CONFIRM' })
    },

    confirm_save_overwrite: () => {
      app.flows.save_note.send({ type: 'CONFIRM_OVERWRITE' })
    },

    retry_save: () => {
      app.flows.save_note.send({ type: 'RETRY' })
    },

    cancel_save: () => {
      app.flows.save_note.send({ type: 'CANCEL' })
    },

    update_image_paste_name: (name) => {
      app.flows.image_paste.send({ type: 'UPDATE_NAME', name })
    },

    confirm_image_paste: () => {
      app.flows.image_paste.send({ type: 'CONFIRM' })
    },

    cancel_image_paste: () => {
      app.flows.image_paste.send({ type: 'CANCEL' })
    },

    retry_image_paste: () => {
      app.flows.image_paste.send({ type: 'RETRY' })
    },

    open_settings: () => {
      app.flows.settings.send({ type: 'OPEN_DIALOG' })
    },

    close_settings: () => {
      app.flows.settings.send({ type: 'CLOSE_DIALOG' })
    },

    update_settings: (new_settings) => {
      app.flows.settings.send({ type: 'UPDATE_SETTINGS', settings: new_settings })
    },

    save_settings: () => {
      app.flows.settings.send({ type: 'SAVE' })
    },

    handle_theme_change: (theme) => {
      app.flows.theme.send({ type: 'SET_THEME', theme })
    },

    request_create_folder: (parent_path) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      if (!vault_id) return

      app.flows.create_folder.send({ type: 'REQUEST_CREATE', vault_id, parent_path })
    },

    confirm_create_folder: () => {
      app.flows.create_folder.send({ type: 'CONFIRM' })
    },

    cancel_create_folder: () => {
      app.flows.create_folder.send({ type: 'CANCEL' })
    },

    update_create_folder_name: (name) => {
      app.flows.create_folder.send({ type: 'UPDATE_FOLDER_NAME', name })
    },

    toggle_sidebar: () => {
      app.stores.ui.actions.toggle_sidebar()
    },

    select_folder_path: (path) => {
      app.stores.ui.actions.set_selected_folder_path(path)
    },

    toggle_filetree_folder: (path) => {
      app.flows.filetree.send({ type: 'TOGGLE_FOLDER', path })
    },

    retry_load_folder: (path) => {
      app.flows.filetree.send({ type: 'RETRY_LOAD', path })
    },

    collapse_all_folders: () => {
      app.flows.filetree.send({ type: 'COLLAPSE_ALL' })
    },

    request_delete_folder: (folder_path) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      if (!vault_id) return

      const open_note_path = app.stores.editor.get_snapshot().open_note?.meta.path ?? ''
      const prefix = folder_path + '/'
      const contains_open_note = open_note_path.startsWith(prefix)

      app.flows.delete_folder.send({
        type: 'REQUEST_DELETE',
        vault_id,
        folder_path,
        contains_open_note
      })
    },

    request_rename_folder: (folder_path) => {
      const vault_id = app.stores.vault.get_snapshot().vault?.id
      if (!vault_id) return

      app.flows.rename_folder.send({ type: 'REQUEST_RENAME', vault_id, folder_path })
    }
  }
}
