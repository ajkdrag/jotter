import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import type { NoteMeta } from '$lib/types/note'
import { as_note_path, type NotePath } from '$lib/types/ids'
import { sanitize_note_name } from '$lib/utils/sanitize_note_name'

function close_delete_dialog(input: ActionRegistrationInput) {
  input.stores.ui.delete_note_dialog = {
    open: false,
    note: null
  }
}

function close_rename_dialog(input: ActionRegistrationInput) {
  input.stores.ui.rename_note_dialog = {
    open: false,
    note: null,
    new_path: null,
    show_overwrite_confirm: false,
    is_checking_conflict: false
  }
}

function close_save_dialog(input: ActionRegistrationInput) {
  input.stores.ui.save_note_dialog = {
    open: false,
    folder_path: '',
    new_path: null,
    show_overwrite_confirm: false,
    is_checking_existence: false
  }
}

function build_full_path(folder_path: string, filename: string): NotePath {
  const sanitized = sanitize_note_name(filename)
  return as_note_path(folder_path ? `${folder_path}/${sanitized}` : sanitized)
}

function filename_from_path(path: string): string {
  const last_slash = path.lastIndexOf('/')
  return last_slash >= 0 ? path.slice(last_slash + 1) : path
}

export function register_note_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input

  registry.register({
    id: ACTION_IDS.note_create,
    label: 'Create Note',
    shortcut: 'CmdOrCtrl+N',
    when: () => stores.vault.vault !== null,
    execute: (folder_prefix?: unknown) => {
      const folder_path =
        typeof folder_prefix === 'string' && folder_prefix.length > 0
          ? folder_prefix
          : stores.ui.selected_folder_path
      services.note.create_new_note(folder_path)
      stores.ui.set_selected_folder_path(folder_path)
    }
  })

  registry.register({
    id: ACTION_IDS.note_open,
    label: 'Open Note',
    when: () => stores.vault.vault !== null,
    execute: async (note_path: unknown) => {
      const result = await services.note.open_note(String(note_path), false)
      if (result.status === 'opened') {
        stores.ui.set_selected_folder_path(result.selected_folder_path)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_open_wiki_link,
    label: 'Open Wiki Link',
    when: () => stores.vault.vault !== null,
    execute: async (note_path: unknown) => {
      const result = await services.note.open_wiki_link(String(note_path))
      if (result.status === 'opened') {
        stores.ui.set_selected_folder_path(result.selected_folder_path)
      }
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
      stores.ui.delete_note_dialog = {
        open: true,
        note: note as NoteMeta
      }
      stores.op.reset('note.delete')
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_delete,
    label: 'Confirm Delete Note',
    execute: async () => {
      const note = stores.ui.delete_note_dialog.note
      if (!note) return

      const result = await services.note.delete_note(note)
      if (result.status === 'deleted') {
        close_delete_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_delete,
    label: 'Cancel Delete Note',
    execute: () => {
      close_delete_dialog(input)
      stores.op.reset('note.delete')
    }
  })

  registry.register({
    id: ACTION_IDS.note_request_rename,
    label: 'Request Rename Note',
    execute: (note: unknown) => {
      const note_meta = note as NoteMeta
      stores.ui.rename_note_dialog = {
        open: true,
        note: note_meta,
        new_path: note_meta.path,
        show_overwrite_confirm: false,
        is_checking_conflict: false
      }
      stores.op.reset('note.rename')
    }
  })

  registry.register({
    id: ACTION_IDS.note_update_rename_path,
    label: 'Update Rename Note Path',
    execute: (path: unknown) => {
      stores.ui.rename_note_dialog.new_path = as_note_path(String(path))
      stores.ui.rename_note_dialog.show_overwrite_confirm = false
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_rename,
    label: 'Confirm Rename Note',
    execute: async () => {
      const note = stores.ui.rename_note_dialog.note
      const new_path = stores.ui.rename_note_dialog.new_path
      if (!note || !new_path) return

      stores.ui.rename_note_dialog.is_checking_conflict = true
      const result = await services.note.rename_note(note, new_path, false)
      stores.ui.rename_note_dialog.is_checking_conflict = false

      if (result.status === 'conflict') {
        stores.ui.rename_note_dialog.show_overwrite_confirm = true
        return
      }

      if (result.status === 'renamed') {
        close_rename_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_rename_overwrite,
    label: 'Confirm Rename Note Overwrite',
    execute: async () => {
      const note = stores.ui.rename_note_dialog.note
      const new_path = stores.ui.rename_note_dialog.new_path
      if (!note || !new_path) return

      const result = await services.note.rename_note(note, new_path, true)
      if (result.status === 'renamed') {
        close_rename_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_rename,
    label: 'Cancel Rename Note',
    execute: () => {
      close_rename_dialog(input)
      stores.op.reset('note.rename')
    }
  })

  registry.register({
    id: ACTION_IDS.note_retry_rename,
    label: 'Retry Rename Note',
    execute: async () => {
      const note = stores.ui.rename_note_dialog.note
      const new_path = stores.ui.rename_note_dialog.new_path
      if (!note || !new_path) return

      const result = await services.note.rename_note(note, new_path, true)
      if (result.status === 'renamed') {
        close_rename_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_request_save,
    label: 'Save Note',
    shortcut: 'CmdOrCtrl+S',
    when: () => stores.vault.vault !== null,
    execute: async () => {
      const open_note = stores.editor.open_note
      if (!open_note) return

      const is_untitled = !open_note.meta.path.endsWith('.md')
      if (!is_untitled) {
        await services.note.save_note(null, true)
        return
      }

      const folder_path = stores.ui.selected_folder_path
      const filename = filename_from_path(open_note.meta.path) || 'Untitled'

      stores.ui.save_note_dialog = {
        open: true,
        folder_path,
        new_path: build_full_path(folder_path, filename),
        show_overwrite_confirm: false,
        is_checking_existence: false
      }
      stores.op.reset('note.save')
    }
  })

  registry.register({
    id: ACTION_IDS.note_update_save_path,
    label: 'Update Save Note Path',
    execute: (path: unknown) => {
      stores.ui.save_note_dialog.new_path = as_note_path(String(path))
      stores.ui.save_note_dialog.show_overwrite_confirm = false
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_save,
    label: 'Confirm Save Note',
    execute: async () => {
      if (!stores.ui.save_note_dialog.open) {
        await services.note.save_note(null, true)
        return
      }

      const path = stores.ui.save_note_dialog.new_path
      if (!path) return

      stores.ui.save_note_dialog.is_checking_existence = true
      const result = await services.note.save_note(path, false)
      stores.ui.save_note_dialog.is_checking_existence = false

      if (result.status === 'conflict') {
        stores.ui.save_note_dialog.show_overwrite_confirm = true
        return
      }

      if (result.status === 'saved') {
        close_save_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_save_overwrite,
    label: 'Confirm Save Note Overwrite',
    execute: async () => {
      const path = stores.ui.save_note_dialog.new_path
      if (!path) return

      const result = await services.note.save_note(path, true)
      if (result.status === 'saved') {
        close_save_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_retry_save,
    label: 'Retry Save Note',
    execute: async () => {
      const path = stores.ui.save_note_dialog.open ? stores.ui.save_note_dialog.new_path : null
      const result = await services.note.save_note(path, true)
      if (result.status === 'saved' && stores.ui.save_note_dialog.open) {
        close_save_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_save,
    label: 'Cancel Save Note',
    execute: () => {
      close_save_dialog(input)
      stores.op.reset('note.save')
    }
  })
}
