import type { SearchPort } from '$lib/ports/search_port'
import type { VaultStore } from '$lib/stores/vault_store.svelte'
import type { UIStore } from '$lib/stores/ui_store.svelte'
import type { OpStore } from '$lib/stores/op_store.svelte'
import type { NoteId } from '$lib/types/ids'
import type { CommandId } from '$lib/types/command_palette'
import { parse_search_query } from '$lib/utils/search_query_parser'
import { search_palette } from '$lib/utils/search_palette'
import { logger } from '$lib/utils/logger'

export class SearchService {
  private active_search_revision = 0

  constructor(
    private readonly search_port: SearchPort,
    private readonly vault_store: VaultStore,
    private readonly ui_store: UIStore,
    private readonly op_store: OpStore
  ) {}

  open_command_palette() {
    const result = search_palette({ query: parse_search_query('') })
    this.ui_store.command_palette = {
      open: true,
      query: '',
      selected_index: 0,
      commands: result.commands,
      settings: result.settings
    }
  }

  close_command_palette() {
    this.ui_store.command_palette = {
      ...this.ui_store.command_palette,
      open: false
    }
  }

  toggle_command_palette() {
    if (this.ui_store.command_palette.open) {
      this.close_command_palette()
      return
    }
    this.open_command_palette()
  }

  set_command_palette_query(query: string) {
    const result = search_palette({ query: parse_search_query(query) })
    this.ui_store.command_palette = {
      ...this.ui_store.command_palette,
      query,
      selected_index: 0,
      commands: result.commands,
      settings: result.settings
    }
  }

  set_command_palette_selected_index(index: number) {
    this.ui_store.command_palette = {
      ...this.ui_store.command_palette,
      selected_index: index
    }
  }

  select_command_palette_command(command: CommandId): void {
    this.close_command_palette()
    void command
  }

  select_command_palette_setting(key: string): void {
    this.close_command_palette()
    void key
  }

  open_file_search() {
    this.ui_store.file_search = {
      ...this.ui_store.file_search,
      open: true,
      query: '',
      results: [],
      selected_index: 0,
      is_searching: false
    }
  }

  close_file_search() {
    this.ui_store.file_search = {
      ...this.ui_store.file_search,
      open: false,
      query: '',
      results: [],
      selected_index: 0,
      is_searching: false
    }
  }

  toggle_file_search() {
    if (this.ui_store.file_search.open) {
      this.close_file_search()
      return
    }
    this.open_file_search()
  }

  set_file_search_selected_index(index: number) {
    this.ui_store.file_search = {
      ...this.ui_store.file_search,
      selected_index: index
    }
  }

  async set_file_search_query(query: string): Promise<void> {
    const trimmed = query.trim()

    this.ui_store.file_search = {
      ...this.ui_store.file_search,
      query,
      selected_index: 0
    }

    if (!trimmed) {
      this.ui_store.file_search = {
        ...this.ui_store.file_search,
        results: [],
        is_searching: false
      }
      this.op_store.reset('search.notes')
      return
    }

    const vault_id = this.vault_store.vault?.id
    if (!vault_id) return

    const revision = ++this.active_search_revision
    this.op_store.start('search.notes')
    this.ui_store.file_search = {
      ...this.ui_store.file_search,
      is_searching: true
    }

    try {
      const results = await this.search_port.search_notes(vault_id, parse_search_query(query), 20)
      if (revision !== this.active_search_revision) return

      this.ui_store.file_search = {
        ...this.ui_store.file_search,
        results,
        is_searching: false
      }
      this.op_store.succeed('search.notes')
    } catch (error) {
      if (revision !== this.active_search_revision) return

      this.ui_store.file_search = {
        ...this.ui_store.file_search,
        results: [],
        is_searching: false
      }
      logger.error(`Search failed: ${String(error)}`)
      this.op_store.fail('search.notes', 'Search failed')
    }
  }

  add_recent_note(note_id: NoteId) {
    const filtered = this.ui_store.file_search.recent_note_ids.filter((id) => id !== note_id)
    this.ui_store.file_search = {
      ...this.ui_store.file_search,
      recent_note_ids: [note_id, ...filtered].slice(0, 10)
    }
  }

  confirm_file_search_note(note_id: NoteId): void {
    this.add_recent_note(note_id)
    this.close_file_search()
  }
}
