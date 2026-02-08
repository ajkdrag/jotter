import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import type { NoteMeta } from '$lib/types/note'
import { as_note_path, type NotePath } from '$lib/types/ids'
import type { ImagePasteRequest } from '$lib/types/editor'
import { sanitize_note_name } from '$lib/utils/sanitize_note_name'
import { to_markdown_asset_target } from '$lib/utils/asset_markdown_path'
import { parent_folder_path } from '$lib/utils/filetree'

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
    new_name: '',
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

function note_name_from_path(path: string): string {
  const filename = filename_from_path(path)
  return filename.endsWith('.md') ? filename.slice(0, -3) : filename
}

function build_note_path_from_name(parent: string, name: string): NotePath {
  const filename = `${name}.md`
  return as_note_path(parent ? `${parent}/${filename}` : filename)
}

function image_alt_text(file_name: string | null): string {
  if (!file_name) return 'image'
  const leaf = file_name.split('/').filter(Boolean).at(-1) ?? ''
  const stem = leaf.replace(/\.[^.]+$/i, '').trim()
  return stem !== '' ? stem : 'image'
}

function safe_stem(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized.length > 0 ? normalized : 'image'
}

function image_extension(mime_type: string, file_name: string | null): string {
  const from_name = file_name?.split('/').pop()?.split('.').pop()?.toLowerCase()
  if (from_name && from_name.length > 0) return from_name

  const from_mime = mime_type.toLowerCase()
  if (from_mime === 'image/jpeg') return 'jpg'
  if (from_mime === 'image/png') return 'png'
  if (from_mime === 'image/gif') return 'gif'
  if (from_mime === 'image/webp') return 'webp'
  if (from_mime === 'image/bmp') return 'bmp'
  if (from_mime === 'image/svg+xml') return 'svg'
  return 'png'
}

function generate_default_filename(
  note_path: NotePath,
  image: { mime_type: string; file_name: string | null },
  now_ms: number
): string {
  const note_parts = String(note_path).split('/').filter(Boolean)
  const note_file = note_parts.pop() ?? 'note.md'
  const note_stem = safe_stem(note_file.replace(/\.md$/i, ''))
  const source_name = image.file_name?.split('/').pop() ?? ''
  const source_stem = source_name.length > 0 ? safe_stem(source_name.replace(/\.[^.]+$/i, '')) : note_stem
  const ext = image_extension(image.mime_type, image.file_name)
  return `${source_stem}-${String(now_ms)}.${ext}`
}

function close_image_paste_dialog(input: ActionRegistrationInput) {
  input.stores.ui.image_paste_dialog = {
    open: false,
    note_id: null,
    note_path: null,
    image: null,
    filename: '',
    estimated_size_bytes: 0,
    target_folder: ''
  }
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
    id: ACTION_IDS.note_insert_pasted_image,
    label: 'Insert Pasted Image',
    when: () => stores.vault.vault !== null,
    execute: async (request: unknown) => {
      const payload = request as ImagePasteRequest
      const open_note = stores.editor.open_note
      if (!open_note) return
      if (open_note.meta.id !== payload.note_id) return

      const write_result = await services.note.save_pasted_image(payload.note_path, payload.image)
      if (write_result.status !== 'saved') return

      const latest_open_note = stores.editor.open_note
      if (!latest_open_note) return
      if (latest_open_note.meta.id !== payload.note_id) return

      const target = to_markdown_asset_target(payload.note_path, write_result.asset_path)
      const alt = image_alt_text(payload.image.file_name)
      services.editor.insert_text(`![${alt}](${target})`)
    }
  })

  registry.register({
    id: ACTION_IDS.note_request_image_paste,
    label: 'Request Image Paste',
    when: () => stores.vault.vault !== null,
    execute: (request: unknown) => {
      const payload = request as ImagePasteRequest
      const open_note = stores.editor.open_note
      if (!open_note) return
      if (open_note.meta.id !== payload.note_id) return

      const estimated_size_bytes = payload.image.bytes.byteLength
      const default_filename = generate_default_filename(payload.note_path, payload.image, Date.now())
      const attachment_folder = stores.ui.editor_settings.attachment_folder || '.assets'

      const note_parts = String(payload.note_path).split('/').filter(Boolean)
      note_parts.pop()
      const note_dir = note_parts.length > 0 ? note_parts.join('/') : ''
      const target_folder = note_dir ? `${note_dir}/${attachment_folder}` : attachment_folder

      stores.ui.image_paste_dialog = {
        open: true,
        note_id: payload.note_id,
        note_path: payload.note_path,
        image: payload.image,
        filename: default_filename,
        estimated_size_bytes,
        target_folder
      }
      stores.op.reset('asset.write')
    }
  })

  registry.register({
    id: ACTION_IDS.note_update_image_paste_filename,
    label: 'Update Image Paste Filename',
    execute: (filename: unknown) => {
      stores.ui.image_paste_dialog.filename = String(filename)
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_image_paste,
    label: 'Confirm Image Paste',
    execute: async () => {
      const dialog = stores.ui.image_paste_dialog
      if (!dialog.open || !dialog.note_id || !dialog.note_path || !dialog.image) return

      const open_note = stores.editor.open_note
      if (!open_note) return
      if (open_note.meta.id !== dialog.note_id) return

      const attachment_folder = stores.ui.editor_settings.attachment_folder || '.assets'
      const write_result = await services.note.save_pasted_image(dialog.note_path, dialog.image, {
        custom_filename: dialog.filename,
        attachment_folder
      })

      if (write_result.status !== 'saved') return

      const latest_open_note = stores.editor.open_note
      if (!latest_open_note) return
      if (latest_open_note.meta.id !== dialog.note_id) return

      const target = to_markdown_asset_target(dialog.note_path, write_result.asset_path)
      const alt = image_alt_text(dialog.image.file_name)
      services.editor.insert_text(`![${alt}](${target})`)

      close_image_paste_dialog(input)
    }
  })

  registry.register({
    id: ACTION_IDS.note_cancel_image_paste,
    label: 'Cancel Image Paste',
    execute: () => {
      close_image_paste_dialog(input)
      stores.op.reset('asset.write')
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
        new_name: note_name_from_path(note_meta.path),
        show_overwrite_confirm: false,
        is_checking_conflict: false
      }
      stores.op.reset('note.rename')
    }
  })

  registry.register({
    id: ACTION_IDS.note_rename,
    label: 'Update Rename Note Name',
    execute: (name: unknown) => {
      stores.ui.rename_note_dialog.new_name = String(name)
      stores.ui.rename_note_dialog.show_overwrite_confirm = false
    }
  })

  registry.register({
    id: ACTION_IDS.note_confirm_rename,
    label: 'Confirm Rename Note',
    execute: async () => {
      const note = stores.ui.rename_note_dialog.note
      const new_name = stores.ui.rename_note_dialog.new_name.trim()
      if (!note || !new_name) return

      const parent = parent_folder_path(note.path)
      const new_path = build_note_path_from_name(parent, new_name)

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

  async function force_rename_note() {
    const note = stores.ui.rename_note_dialog.note
    const new_name = stores.ui.rename_note_dialog.new_name.trim()
    if (!note || !new_name) return

    const parent = parent_folder_path(note.path)
    const new_path = build_note_path_from_name(parent, new_name)

    const result = await services.note.rename_note(note, new_path, true)
    if (result.status === 'renamed') {
      close_rename_dialog(input)
    }
  }

  registry.register({
    id: ACTION_IDS.note_confirm_rename_overwrite,
    label: 'Confirm Rename Note Overwrite',
    execute: force_rename_note
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
    execute: force_rename_note
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
