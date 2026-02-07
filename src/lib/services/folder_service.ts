import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { NotesStore } from '$lib/stores/notes_store.svelte'
import type { EditorStore } from '$lib/stores/editor_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import { error_message } from '$lib/utils/error_message'
import { ensure_open_note } from '$lib/utils/ensure_open_note'
import { logger } from '$lib/utils/logger'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

function should_load_folder(state: 'unloaded' | 'loading' | 'loaded' | 'error' | undefined): boolean {
  return !state || state === 'unloaded' || state === 'error'
}

export class FolderService {
  constructor(
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly ui_store: UIStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number
  ) {}

  async on_vault_changed(): Promise<void> {
    this.ui_store.filetree = {
      expanded_paths: new SvelteSet<string>(),
      load_states: new SvelteMap<string, 'unloaded' | 'loading' | 'loaded' | 'error'>(),
      error_messages: new SvelteMap<string, string>()
    }
    await this.load_folder('')
  }

  async refresh_filetree(): Promise<void> {
    await this.on_vault_changed()
  }

  collapse_all_folders() {
    this.ui_store.filetree = {
      ...this.ui_store.filetree,
      expanded_paths: new SvelteSet<string>()
    }
  }

  async toggle_folder(path: string): Promise<void> {
    const expanded = new SvelteSet(this.ui_store.filetree.expanded_paths)

    if (expanded.has(path)) {
      expanded.delete(path)
      this.ui_store.filetree = {
        ...this.ui_store.filetree,
        expanded_paths: expanded
      }
      return
    }

    expanded.add(path)
    this.ui_store.filetree = {
      ...this.ui_store.filetree,
      expanded_paths: expanded
    }

    await this.load_folder(path)
  }

  async retry_load(path: string): Promise<void> {
    await this.load_folder(path)
  }

  request_create(parent_path: string) {
    this.ui_store.create_folder_dialog = {
      open: true,
      parent_path,
      folder_name: ''
    }
    this.op_store.reset('folder.create')
  }

  update_create_name(name: string) {
    this.ui_store.create_folder_dialog.folder_name = name
  }

  cancel_create() {
    this.ui_store.create_folder_dialog = {
      open: false,
      parent_path: '',
      folder_name: ''
    }
    this.op_store.reset('folder.create')
  }

  async confirm_create(): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) return

    const { parent_path, folder_name } = this.ui_store.create_folder_dialog
    const trimmed_name = folder_name.trim()
    if (!trimmed_name) return

    this.op_store.start('folder.create')

    try {
      await this.notes_port.create_folder(vault_id, parent_path, trimmed_name)
      const new_folder_path = parent_path ? `${parent_path}/${trimmed_name}` : trimmed_name
      this.notes_store.add_folder_path(new_folder_path)
      this.cancel_create()
      this.op_store.succeed('folder.create')
    } catch (error) {
      logger.error(`Create folder failed: ${error_message(error)}`)
      this.op_store.fail('folder.create', error_message(error))
    }
  }

  async request_delete(folder_path: string): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) return

    this.ui_store.delete_folder_dialog = {
      open: true,
      folder_path,
      affected_note_count: 0,
      affected_folder_count: 0,
      status: 'fetching_stats'
    }

    this.op_store.reset('folder.delete')

    try {
      const stats = await this.notes_port.get_folder_stats(vault_id, folder_path)
      this.ui_store.delete_folder_dialog = {
        ...this.ui_store.delete_folder_dialog,
        status: 'confirming',
        affected_note_count: stats.note_count,
        affected_folder_count: stats.folder_count
      }
    } catch (error) {
      logger.error(`Load folder delete stats failed: ${error_message(error)}`)
      this.op_store.fail('folder.delete', error_message(error))
    }
  }

  cancel_delete() {
    this.ui_store.delete_folder_dialog = {
      open: false,
      folder_path: null,
      affected_note_count: 0,
      affected_folder_count: 0,
      status: 'idle'
    }
    this.op_store.reset('folder.delete')
  }

  async confirm_delete(): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    const folder_path = this.ui_store.delete_folder_dialog.folder_path

    if (!vault_id || !folder_path) return

    this.op_store.start('folder.delete')

    try {
      const folder_prefix = `${folder_path}/`
      const contains_open_note =
        this.editor_store.open_note?.meta.path.startsWith(folder_prefix) ?? false

      const result = await this.notes_port.delete_folder(vault_id, folder_path)

      for (const note_id of result.deleted_notes) {
        await this.index_port.remove_note(vault_id, note_id)
      }

      this.notes_store.remove_folder(folder_path)

      const ensured = ensure_open_note({
        vault: this.vault_store.vault,
        notes: this.notes_store.notes,
        open_note: contains_open_note ? null : this.editor_store.open_note,
        now_ms: this.now_ms()
      })

      if (ensured) {
        this.editor_store.set_open_note(ensured)
      } else {
        this.editor_store.clear_open_note()
      }

      this.cancel_delete()
      this.op_store.succeed('folder.delete')
    } catch (error) {
      logger.error(`Delete folder failed: ${error_message(error)}`)
      this.op_store.fail('folder.delete', error_message(error))
    }
  }

  async retry_delete(): Promise<void> {
    await this.confirm_delete()
  }

  request_rename(folder_path: string) {
    this.ui_store.rename_folder_dialog = {
      open: true,
      folder_path,
      new_path: folder_path
    }
    this.op_store.reset('folder.rename')
  }

  update_rename_path(path: string) {
    this.ui_store.rename_folder_dialog.new_path = path
  }

  cancel_rename() {
    this.ui_store.rename_folder_dialog = {
      open: false,
      folder_path: null,
      new_path: null
    }
    this.op_store.reset('folder.rename')
  }

  async confirm_rename(): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    const folder_path = this.ui_store.rename_folder_dialog.folder_path
    const new_path = this.ui_store.rename_folder_dialog.new_path

    if (!vault_id || !folder_path || !new_path) return

    this.op_store.start('folder.rename')

    try {
      const old_prefix = `${folder_path}/`
      const new_prefix = `${new_path}/`
      const has_affected_notes = this.notes_store.notes.some((note) => note.path.startsWith(old_prefix))

      await this.notes_port.rename_folder(vault_id, folder_path, new_path)
      if (has_affected_notes) {
        await this.index_port.build_index(vault_id)
      }

      this.notes_store.rename_folder(folder_path, new_path)
      this.editor_store.update_open_note_path_prefix(old_prefix, new_prefix)

      this.cancel_rename()
      this.op_store.succeed('folder.rename')
    } catch (error) {
      logger.error(`Rename folder failed: ${error_message(error)}`)
      this.op_store.fail('folder.rename', error_message(error))
    }
  }

  async retry_rename(): Promise<void> {
    await this.confirm_rename()
  }

  private async load_folder(path: string): Promise<void> {
    const vault_id = this.vault_store.vault?.id
    if (!vault_id) return

    const generation = this.vault_store.generation
    const current_state = this.ui_store.filetree.load_states.get(path)
    if (!should_load_folder(current_state)) return

    const load_states = new SvelteMap(this.ui_store.filetree.load_states)
    load_states.set(path, 'loading')

    const error_messages = new SvelteMap(this.ui_store.filetree.error_messages)
    error_messages.delete(path)

    this.ui_store.filetree = {
      ...this.ui_store.filetree,
      load_states,
      error_messages
    }

    try {
      const contents = await this.notes_port.list_folder_contents(vault_id, path)

      if (generation !== this.vault_store.generation) return

      this.notes_store.merge_folder_contents(path, contents)

      const next_load_states = new SvelteMap(this.ui_store.filetree.load_states)
      next_load_states.set(path, 'loaded')

      const next_error_messages = new SvelteMap(this.ui_store.filetree.error_messages)
      next_error_messages.delete(path)

      this.ui_store.filetree = {
        ...this.ui_store.filetree,
        load_states: next_load_states,
        error_messages: next_error_messages
      }
    } catch (error) {
      if (generation !== this.vault_store.generation) return

      const next_load_states = new SvelteMap(this.ui_store.filetree.load_states)
      next_load_states.set(path, 'error')

      const next_error_messages = new SvelteMap(this.ui_store.filetree.error_messages)
      const message = error_message(error)
      logger.error(`Load folder failed (${path}): ${message}`)
      next_error_messages.set(path, message)

      this.ui_store.filetree = {
        ...this.ui_store.filetree,
        load_states: next_load_states,
        error_messages: next_error_messages
      }
    }
  }
}
