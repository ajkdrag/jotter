import type { ThemeMode } from '$lib/types/theme'
import type { EditorSettings } from '$lib/types/editor_settings'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'
import type { NoteMeta } from '$lib/types/note'
import type { NoteId, NotePath } from '$lib/types/ids'
import type { FolderLoadState } from '$lib/types/filetree'
import type { NoteSearchHit } from '$lib/types/search'
import type { CommandDefinition } from '$lib/types/command_palette'
import type { SettingDefinition } from '$lib/types/settings_registry'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

export type AsyncStatus = 'idle' | 'loading' | 'error'

export class UIStore {
  theme = $state<ThemeMode>('system')
  sidebar_open = $state(true)
  selected_folder_path = $state('')
  editor_settings = $state<EditorSettings>({ ...DEFAULT_EDITOR_SETTINGS })
  system_dialog_open = $state(false)

  startup = $state<{ status: AsyncStatus; error: string | null }>({
    status: 'idle',
    error: null
  })

  change_vault = $state<{ open: boolean; is_loading: boolean; error: string | null }>({
    open: false,
    is_loading: false,
    error: null
  })

  delete_note_dialog = $state<{ open: boolean; note: NoteMeta | null }>({
    open: false,
    note: null
  })

  rename_note_dialog = $state<{
    open: boolean
    note: NoteMeta | null
    new_path: NotePath | null
    show_overwrite_confirm: boolean
    is_checking_conflict: boolean
  }>({
    open: false,
    note: null,
    new_path: null,
    show_overwrite_confirm: false,
    is_checking_conflict: false
  })

  save_note_dialog = $state<{
    open: boolean
    new_path: NotePath | null
    folder_path: string
    show_overwrite_confirm: boolean
    is_checking_existence: boolean
  }>({
    open: false,
    new_path: null,
    folder_path: '',
    show_overwrite_confirm: false,
    is_checking_existence: false
  })

  create_folder_dialog = $state<{
    open: boolean
    parent_path: string
    folder_name: string
  }>({
    open: false,
    parent_path: '',
    folder_name: ''
  })

  delete_folder_dialog = $state<{
    open: boolean
    folder_path: string | null
    affected_note_count: number
    affected_folder_count: number
    status: 'idle' | 'fetching_stats' | 'confirming'
  }>({
    open: false,
    folder_path: null,
    affected_note_count: 0,
    affected_folder_count: 0,
    status: 'idle'
  })

  rename_folder_dialog = $state<{
    open: boolean
    folder_path: string | null
    new_path: string | null
  }>({
    open: false,
    folder_path: null,
    new_path: null
  })

  settings_dialog = $state<{
    open: boolean
    current_settings: EditorSettings
    has_unsaved_changes: boolean
  }>({
    open: false,
    current_settings: { ...DEFAULT_EDITOR_SETTINGS },
    has_unsaved_changes: false
  })

  command_palette = $state<{
    open: boolean
    query: string
    selected_index: number
    commands: CommandDefinition[]
    settings: SettingDefinition[]
  }>({
    open: false,
    query: '',
    selected_index: 0,
    commands: [],
    settings: []
  })

  file_search = $state<{
    open: boolean
    query: string
    results: NoteSearchHit[]
    recent_note_ids: NoteId[]
    selected_index: number
    is_searching: boolean
  }>({
    open: false,
    query: '',
    results: [],
    recent_note_ids: [],
    selected_index: 0,
    is_searching: false
  })

  filetree = $state<{
    expanded_paths: SvelteSet<string>
    load_states: SvelteMap<string, FolderLoadState>
    error_messages: SvelteMap<string, string>
  }>({
    expanded_paths: new SvelteSet<string>(),
    load_states: new SvelteMap<string, FolderLoadState>(),
    error_messages: new SvelteMap<string, string>()
  })

  set_theme(theme: ThemeMode) {
    this.theme = theme
  }

  toggle_sidebar() {
    this.sidebar_open = !this.sidebar_open
  }

  set_selected_folder_path(path: string) {
    this.selected_folder_path = path
  }

  set_editor_settings(settings: EditorSettings) {
    this.editor_settings = settings
    this.settings_dialog.current_settings = settings
  }

  set_system_dialog_open(open: boolean) {
    this.system_dialog_open = open
  }

  reset_for_new_vault() {
    this.selected_folder_path = ''
    this.delete_note_dialog = { open: false, note: null }
    this.rename_note_dialog = {
      open: false,
      note: null,
      new_path: null,
      show_overwrite_confirm: false,
      is_checking_conflict: false
    }
    this.save_note_dialog = {
      open: false,
      new_path: null,
      folder_path: '',
      show_overwrite_confirm: false,
      is_checking_existence: false
    }
    this.create_folder_dialog = {
      open: false,
      parent_path: '',
      folder_name: ''
    }
    this.delete_folder_dialog = {
      open: false,
      folder_path: null,
      affected_note_count: 0,
      affected_folder_count: 0,
      status: 'idle'
    }
    this.rename_folder_dialog = {
      open: false,
      folder_path: null,
      new_path: null
    }
    this.settings_dialog = {
      open: false,
      current_settings: { ...this.editor_settings },
      has_unsaved_changes: false
    }
    this.command_palette = {
      open: false,
      query: '',
      selected_index: 0,
      commands: [],
      settings: []
    }
    this.file_search = {
      open: false,
      query: '',
      results: [],
      recent_note_ids: [],
      selected_index: 0,
      is_searching: false
    }
    this.filetree = {
      expanded_paths: new SvelteSet<string>(),
      load_states: new SvelteMap<string, FolderLoadState>(),
      error_messages: new SvelteMap<string, string>()
    }
  }
}
