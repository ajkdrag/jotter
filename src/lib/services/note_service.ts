import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import { as_markdown_text, as_note_path, type NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { NotesStore } from '$lib/stores/notes_store.svelte'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import { error_message } from '$lib/utils/error_message'
import { ensure_open_note, create_untitled_open_note_in_folder } from '$lib/utils/ensure_open_note'
import { parent_folder_path } from '$lib/utils/filetree'
import { resolve_existing_note_path } from '$lib/utils/note_lookup'
import { note_path_exists } from '$lib/utils/note_path_exists'
import { sanitize_note_name } from '$lib/utils/sanitize_note_name'
import type { EditorService } from '$lib/services/editor_service'
import { to_open_note_state } from '$lib/types/editor'
import { create_write_queue } from '$lib/utils/write_queue'
import { logger } from '$lib/utils/logger'

function get_filename_from_path(path: string): string {
  const last_slash = path.lastIndexOf('/')
  return last_slash >= 0 ? path.slice(last_slash + 1) : path
}

function build_full_path(folder_path: string, filename: string): NotePath {
  const sanitized = sanitize_note_name(filename)
  const full_path = folder_path ? `${folder_path}/${sanitized}` : sanitized
  return as_note_path(full_path)
}

export class NoteService {
  private readonly enqueue_write = create_write_queue()
  private open_abort: AbortController | null = null

  constructor(
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly ui_store: UIStore,
    private readonly op_store: OpStore,
    private readonly editor_service: EditorService,
    private readonly now_ms: () => number
  ) {}

  create_new_note(folder_prefix?: string) {
    const folder_path = folder_prefix ?? this.ui_store.selected_folder_path
    const open_note = create_untitled_open_note_in_folder({
      notes: this.notes_store.notes,
      folder_prefix: folder_path,
      now_ms: this.now_ms()
    })

    this.editor_store.set_open_note(open_note)
    this.ui_store.set_selected_folder_path(folder_path)
  }

  async open_note(note_path: string, create_if_missing: boolean = false): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) return

    this.open_abort?.abort()
    const controller = new AbortController()
    this.open_abort = controller

    const op_key = `note.open:${note_path}`
    this.op_store.start(op_key)

    try {
      const resolved_existing = create_if_missing
        ? resolve_existing_note_path(this.notes_store.notes, note_path)
        : null
      const resolved_path = as_note_path(resolved_existing ?? note_path)

      const current_open_id = this.editor_store.open_note?.meta.id ?? null
      if (current_open_id && current_open_id === resolved_path) {
        this.op_store.succeed(op_key)
        return
      }

      let created = false
      let doc
      try {
        doc = await this.notes_port.read_note(vault_id, resolved_path)
      } catch (error) {
        if (!create_if_missing) {
          throw error
        }

        const meta = await this.notes_port.create_note(vault_id, resolved_path, as_markdown_text(''))
        doc = {
          meta,
          markdown: as_markdown_text('')
        }
        created = true
      }

      if (controller.signal.aborted) return

      if (created) {
        this.notes_store.add_note(doc.meta)
      }

      this.editor_store.set_open_note(to_open_note_state(doc))
      this.ui_store.set_selected_folder_path(parent_folder_path(resolved_path))
      this.op_store.succeed(op_key)
    } catch (error) {
      if (controller.signal.aborted) return
      this.op_store.fail(op_key, error_message(error))
      throw error
    }
  }

  async open_wiki_link(note_path: string): Promise<void> {
    await this.open_note(note_path, true)
  }

  request_delete(note: NoteMeta) {
    this.ui_store.delete_note_dialog = {
      open: true,
      note
    }
    this.op_store.reset('note.delete')
  }

  cancel_delete() {
    this.ui_store.delete_note_dialog = {
      open: false,
      note: null
    }
    this.op_store.reset('note.delete')
  }

  async confirm_delete(): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    const note = this.ui_store.delete_note_dialog.note
    if (!vault_id || !note) return

    this.op_store.start('note.delete')

    try {
      await this.notes_port.delete_note(vault_id, note.id)
      await this.index_port.remove_note(vault_id, note.id)

      const is_open_note = this.editor_store.open_note?.meta.id === note.id
      this.notes_store.remove_note(note.id)

      const ensured = ensure_open_note({
        vault: this.vault_store.vault,
        notes: this.notes_store.notes,
        open_note: is_open_note ? null : this.editor_store.open_note,
        now_ms: this.now_ms()
      })

      if (ensured) {
        this.editor_store.set_open_note(ensured)
      } else {
        this.editor_store.clear_open_note()
      }

      this.ui_store.delete_note_dialog = {
        open: false,
        note: null
      }
      this.op_store.succeed('note.delete')
    } catch (error) {
      this.op_store.fail('note.delete', error_message(error))
    }
  }

  request_rename(note: NoteMeta) {
    this.ui_store.rename_note_dialog = {
      open: true,
      note,
      new_path: note.path,
      show_overwrite_confirm: false,
      is_checking_conflict: false
    }
    this.op_store.reset('note.rename')
  }

  update_rename_path(path: string) {
    this.ui_store.rename_note_dialog.new_path = as_note_path(path)
    this.ui_store.rename_note_dialog.show_overwrite_confirm = false
  }

  cancel_rename() {
    this.ui_store.rename_note_dialog = {
      open: false,
      note: null,
      new_path: null,
      show_overwrite_confirm: false,
      is_checking_conflict: false
    }
    this.op_store.reset('note.rename')
  }

  async confirm_rename(): Promise<void> {
    const note = this.ui_store.rename_note_dialog.note
    const new_path = this.ui_store.rename_note_dialog.new_path

    if (!note || !new_path) return

    this.ui_store.rename_note_dialog.is_checking_conflict = true

    const target_exists = note.path !== new_path && note_path_exists(this.notes_store.notes, new_path)

    if (target_exists) {
      this.ui_store.rename_note_dialog.is_checking_conflict = false
      this.ui_store.rename_note_dialog.show_overwrite_confirm = true
      return
    }

    await this.perform_rename_note(false)
  }

  async confirm_rename_overwrite(): Promise<void> {
    await this.perform_rename_note(true)
  }

  async retry_rename(): Promise<void> {
    await this.perform_rename_note(true)
  }

  private async perform_rename_note(_overwrite: boolean): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    const note = this.ui_store.rename_note_dialog.note
    const new_path = this.ui_store.rename_note_dialog.new_path

    if (!vault_id || !note || !new_path) return

    this.ui_store.rename_note_dialog.is_checking_conflict = false
    this.op_store.start('note.rename')

    try {
      await this.notes_port.rename_note(vault_id, note.path, new_path)
      await this.index_port.remove_note(vault_id, note.id)
      await this.index_port.upsert_note(vault_id, new_path)

      this.notes_store.rename_note(note.path, new_path)

      if (this.editor_store.open_note?.meta.id === note.id) {
        this.editor_store.update_open_note_path(new_path)
      }

      this.cancel_rename()
      this.op_store.succeed('note.rename')
    } catch (error) {
      this.op_store.fail('note.rename', error_message(error))
    }
  }

  request_save() {
    const open_note = this.editor_store.open_note
    if (!open_note) return

    const is_untitled = !open_note.meta.path.endsWith('.md')
    if (!is_untitled) {
      void this.save_open_note(null)
      return
    }

    const folder_path = this.ui_store.selected_folder_path
    const filename = get_filename_from_path(open_note.meta.path) || 'Untitled'

    this.ui_store.save_note_dialog = {
      open: true,
      folder_path,
      new_path: build_full_path(folder_path, filename),
      show_overwrite_confirm: false,
      is_checking_existence: false
    }
    this.op_store.reset('note.save')
  }

  update_save_path(path: string) {
    this.ui_store.save_note_dialog.new_path = as_note_path(path)
    this.ui_store.save_note_dialog.show_overwrite_confirm = false
  }

  cancel_save() {
    this.ui_store.save_note_dialog = {
      open: false,
      folder_path: '',
      new_path: null,
      show_overwrite_confirm: false,
      is_checking_existence: false
    }
    this.op_store.reset('note.save')
  }

  async confirm_save(): Promise<void> {
    const open_note = this.editor_store.open_note
    if (!open_note) return

    if (!this.ui_store.save_note_dialog.open) {
      await this.save_open_note(null)
      return
    }

    const path = this.ui_store.save_note_dialog.new_path
    if (!path) return

    this.ui_store.save_note_dialog.is_checking_existence = true
    const target_exists = note_path_exists(this.notes_store.notes, path)

    if (target_exists) {
      this.ui_store.save_note_dialog.is_checking_existence = false
      this.ui_store.save_note_dialog.show_overwrite_confirm = true
      return
    }

    await this.save_open_note(path)
  }

  async confirm_save_overwrite(): Promise<void> {
    await this.save_open_note(this.ui_store.save_note_dialog.new_path)
  }

  async retry_save(): Promise<void> {
    const new_path = this.ui_store.save_note_dialog.open
      ? this.ui_store.save_note_dialog.new_path
      : null
    await this.save_open_note(new_path)
  }

  async copy_open_note_markdown(write_text: (text: string) => Promise<void>): Promise<void> {
    const markdown = this.editor_store.open_note?.markdown
    if (!markdown) return

    try {
      await write_text(markdown)
    } catch (error) {
      logger.error(`Clipboard write failed: ${error_message(error)}`)
      throw error
    }
  }

  private async save_open_note(new_path: NotePath | null): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    const open_note = this.editor_store.open_note
    if (!vault_id || !open_note) return

    this.op_store.start('note.save')
    this.ui_store.save_note_dialog.is_checking_existence = false

    try {
      const flushed = this.editor_service.flush()
      if (flushed && flushed.note_id === open_note.meta.id) {
        this.editor_store.set_markdown(flushed.note_id, flushed.markdown)
      }

      const latest_open_note = this.editor_store.open_note
      if (!latest_open_note) return

      const is_untitled = !latest_open_note.meta.path.endsWith('.md')

      if (is_untitled && new_path) {
        await this.enqueue_write(`note.save:${latest_open_note.meta.id}`, async () => {
          const created_meta = await this.notes_port.create_note(vault_id, new_path, latest_open_note.markdown)
          await this.index_port.upsert_note(vault_id, created_meta.id)
          this.notes_store.add_note(created_meta)
          this.editor_store.update_open_note_path(new_path)
          this.editor_store.mark_clean(new_path)
        })
      } else {
        await this.enqueue_write(`note.save:${latest_open_note.meta.id}`, async () => {
          await this.notes_port.write_note(vault_id, latest_open_note.meta.id, latest_open_note.markdown)
          await this.index_port.upsert_note(vault_id, latest_open_note.meta.id)
          this.editor_store.mark_clean(latest_open_note.meta.id)
        })
      }

      this.editor_service.mark_clean()
      this.cancel_save()
      this.op_store.succeed('note.save')
    } catch (error) {
      this.op_store.fail('note.save', error_message(error))
    }
  }
}
