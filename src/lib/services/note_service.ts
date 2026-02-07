import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import { as_markdown_text, as_note_path, type NotePath, type AssetPath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { NotesStore } from '$lib/stores/notes_store.svelte'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { AssetsPort } from '$lib/ports/assets_port'
import type {
  NoteDeleteResult,
  NoteOpenResult,
  NoteRenameResult,
  NoteSaveResult
} from '$lib/types/note_service_result'
import { error_message } from '$lib/utils/error_message'
import { ensure_open_note, create_untitled_open_note_in_folder } from '$lib/utils/ensure_open_note'
import { parent_folder_path } from '$lib/utils/filetree'
import { resolve_existing_note_path } from '$lib/utils/note_lookup'
import { note_path_exists } from '$lib/utils/note_path_exists'
import type { EditorService } from '$lib/services/editor_service'
import { to_open_note_state, type PastedImagePayload } from '$lib/types/editor'
import { create_write_queue } from '$lib/utils/write_queue'
import { logger } from '$lib/utils/logger'

export class NoteService {
  private readonly enqueue_write = create_write_queue()
  private open_abort: AbortController | null = null

  constructor(
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly assets_port: AssetsPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore,
    private readonly editor_service: EditorService,
    private readonly now_ms: () => number
  ) {}

  create_new_note(folder_path: string) {
    const open_note = create_untitled_open_note_in_folder({
      notes: this.notes_store.notes,
      folder_prefix: folder_path,
      now_ms: this.now_ms()
    })

    this.editor_store.set_open_note(open_note)
  }

  async open_note(note_path: string, create_if_missing: boolean = false): Promise<NoteOpenResult> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return { status: 'skipped' }
    }

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
        return {
          status: 'opened',
          selected_folder_path: parent_folder_path(resolved_path)
        }
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

      if (controller.signal.aborted) {
        return { status: 'skipped' }
      }

      if (created) {
        this.notes_store.add_note(doc.meta)
      }

      this.editor_store.set_open_note(to_open_note_state(doc))
      this.op_store.succeed(op_key)

      return {
        status: 'opened',
        selected_folder_path: parent_folder_path(resolved_path)
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return { status: 'skipped' }
      }

      const message = error_message(error)
      logger.error(`Open note failed: ${message}`)
      this.op_store.fail(op_key, message)
      return { status: 'failed', error: message }
    }
  }

  async open_wiki_link(note_path: string): Promise<NoteOpenResult> {
    return this.open_note(note_path, true)
  }

  async save_pasted_image(
    note_path: NotePath,
    image: PastedImagePayload,
    options?: { custom_filename?: string; attachment_folder?: string }
  ): Promise<{ status: 'saved'; asset_path: AssetPath } | { status: 'skipped' } | { status: 'failed'; error: string }> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return { status: 'skipped' }
    }

    this.op_store.start('asset.write')

    try {
      const input: Parameters<AssetsPort['write_image_asset']>[1] = {
        note_path,
        image
      }
      if (options?.custom_filename) {
        input.custom_filename = options.custom_filename
      }
      if (options?.attachment_folder) {
        input.attachment_folder = options.attachment_folder
      }
      const asset_path = await this.assets_port.write_image_asset(vault_id, input)
      this.op_store.succeed('asset.write')
      return {
        status: 'saved',
        asset_path
      }
    } catch (error) {
      const message = error_message(error)
      logger.error(`Write image asset failed: ${message}`)
      this.op_store.fail('asset.write', message)
      return {
        status: 'failed',
        error: message
      }
    }
  }

  async delete_note(note: NoteMeta): Promise<NoteDeleteResult> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return { status: 'skipped' }
    }

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

      this.op_store.succeed('note.delete')
      return { status: 'deleted' }
    } catch (error) {
      const message = error_message(error)
      logger.error(`Delete note failed: ${message}`)
      this.op_store.fail('note.delete', message)
      return {
        status: 'failed',
        error: message
      }
    }
  }

  async rename_note(note: NoteMeta, new_path: NotePath, overwrite: boolean): Promise<NoteRenameResult> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) {
      return { status: 'skipped' }
    }

    const target_exists = note.path !== new_path && note_path_exists(this.notes_store.notes, new_path)
    if (target_exists && !overwrite) {
      return { status: 'conflict' }
    }

    this.op_store.start('note.rename')

    try {
      await this.notes_port.rename_note(vault_id, note.path, new_path)
      await this.index_port.remove_note(vault_id, note.id)
      await this.index_port.upsert_note(vault_id, new_path)

      this.notes_store.rename_note(note.path, new_path)

      if (this.editor_store.open_note?.meta.id === note.id) {
        this.editor_store.update_open_note_path(new_path)
      }

      this.op_store.succeed('note.rename')
      return { status: 'renamed' }
    } catch (error) {
      const message = error_message(error)
      logger.error(`Rename note failed: ${message}`)
      this.op_store.fail('note.rename', message)
      return {
        status: 'failed',
        error: message
      }
    }
  }

  async save_note(target_path: NotePath | null, overwrite: boolean): Promise<NoteSaveResult> {
    const vault_id = this.vault_store.vault?.id
    const open_note = this.editor_store.open_note
    if (!vault_id || !open_note) {
      return { status: 'skipped' }
    }

    const flushed = this.editor_service.flush()
    if (flushed && flushed.note_id === open_note.meta.id) {
      this.editor_store.set_markdown(flushed.note_id, flushed.markdown)
    }

    const latest_open_note = this.editor_store.open_note
    if (!latest_open_note) {
      return { status: 'skipped' }
    }

    const is_untitled = !latest_open_note.meta.path.endsWith('.md')
    if (is_untitled) {
      if (!target_path) {
        return { status: 'skipped' }
      }

      const target_exists = note_path_exists(this.notes_store.notes, target_path)
      if (target_exists && !overwrite) {
        return { status: 'conflict' }
      }
    }

    this.op_store.start('note.save')

    try {
      if (is_untitled && target_path) {
        await this.enqueue_write(`note.save:${latest_open_note.meta.id}`, async () => {
          const created_meta = await this.notes_port.create_note(vault_id, target_path, latest_open_note.markdown)
          await this.index_port.upsert_note(vault_id, created_meta.id)
          this.notes_store.add_note(created_meta)
          this.editor_store.update_open_note_path(target_path)
          this.editor_store.mark_clean(target_path)
        })
      } else {
        await this.enqueue_write(`note.save:${latest_open_note.meta.id}`, async () => {
          await this.notes_port.write_note(vault_id, latest_open_note.meta.id, latest_open_note.markdown)
          await this.index_port.upsert_note(vault_id, latest_open_note.meta.id)
          this.editor_store.mark_clean(latest_open_note.meta.id)
        })
      }

      this.editor_service.mark_clean()
      this.op_store.succeed('note.save')

      const saved_path = this.editor_store.open_note?.meta.path ?? latest_open_note.meta.path
      return {
        status: 'saved',
        saved_path: as_note_path(saved_path)
      }
    } catch (error) {
      const message = error_message(error)
      logger.error(`Save note failed: ${message}`)
      this.op_store.fail('note.save', message)
      return {
        status: 'failed',
        error: message
      }
    }
  }
}
