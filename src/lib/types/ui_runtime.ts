import type { CursorInfo } from '$lib/types/editor'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { FolderLoadState } from '$lib/types/filetree'
import type { NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { NoteSearchHit } from '$lib/types/search'
import type { SettingDefinition } from '$lib/types/settings_registry'
import type { CommandDefinition } from '$lib/utils/search_commands'

export type DialogRuntime<TState extends string, TData> = {
  state: TState
  error: string | null
  data: TData
}

export type UIRuntimeState = {
  vault_bootstrap: {
    state: string
    error: string | null
  }
  change_vault: {
    state: string
    error: string | null
  }
  delete_note: DialogRuntime<
    string,
    {
      note_to_delete: NoteMeta | null
    }
  >
  rename_note: DialogRuntime<
    string,
    {
      note_to_rename: NoteMeta | null
      new_path: NotePath | null
    }
  >
  save_note: DialogRuntime<
    string,
    {
      new_path: NotePath | null
      folder_path: string
      requires_dialog: boolean
    }
  >
  create_folder: DialogRuntime<
    string,
    {
      parent_path: string
      folder_name: string
    }
  >
  delete_folder: DialogRuntime<
    string,
    {
      folder_path: string | null
      affected_note_count: number
      affected_folder_count: number
    }
  >
  rename_folder: DialogRuntime<
    string,
    {
      folder_path: string | null
      new_path: string | null
    }
  >
  settings: DialogRuntime<
    string,
    {
      has_unsaved_changes: boolean
      current_settings: EditorSettings
    }
  >
  command_palette: {
    state: string
    query: string
    selected_index: number
    commands: CommandDefinition[]
    settings: SettingDefinition[]
  }
  file_search: {
    state: string
    query: string
    results: NoteSearchHit[]
    recent_note_ids: NoteId[]
    selected_index: number
    is_searching: boolean
  }
  filetree: {
    expanded_paths: Set<string>
    load_states: Map<string, FolderLoadState>
    error_messages: Map<string, string>
  }
  editor: {
    cursor: CursorInfo | null
  }
}

export function create_default_ui_runtime_state(): UIRuntimeState {
  return {
    vault_bootstrap: { state: 'idle', error: null },
    change_vault: { state: 'idle', error: null },
    delete_note: {
      state: 'idle',
      error: null,
      data: { note_to_delete: null }
    },
    rename_note: {
      state: 'idle',
      error: null,
      data: { note_to_rename: null, new_path: null }
    },
    save_note: {
      state: 'idle',
      error: null,
      data: { new_path: null, folder_path: '', requires_dialog: false }
    },
    create_folder: {
      state: 'idle',
      error: null,
      data: { parent_path: '', folder_name: '' }
    },
    delete_folder: {
      state: 'idle',
      error: null,
      data: { folder_path: null, affected_note_count: 0, affected_folder_count: 0 }
    },
    rename_folder: {
      state: 'idle',
      error: null,
      data: { folder_path: null, new_path: null }
    },
    settings: {
      state: 'idle',
      error: null,
      data: {
        has_unsaved_changes: false,
        current_settings: {
          font_size: 1.0,
          line_height: 1.75,
          heading_color: 'inherit',
          spacing: 'normal',
          link_syntax: 'wikilink'
        }
      }
    },
    command_palette: {
      state: 'closed',
      query: '',
      selected_index: 0,
      commands: [],
      settings: []
    },
    file_search: {
      state: 'closed',
      query: '',
      results: [],
      recent_note_ids: [],
      selected_index: 0,
      is_searching: false
    },
    filetree: {
      expanded_paths: new Set<string>(),
      load_states: new Map<string, FolderLoadState>(),
      error_messages: new Map<string, string>()
    },
    editor: {
      cursor: null
    }
  }
}
