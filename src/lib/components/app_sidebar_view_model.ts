import type { EditorManager } from '$lib/operations/manage_editor'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { FolderLoadState } from '$lib/types/filetree'
import type { ThemeMode } from '$lib/stores/ui_store'
import type { AppShellActions } from '$lib/components/app_shell_actions'
import type { EditorSettings } from '$lib/types/editor_settings'

export type AppSidebarViewModelInput = {
  editor_manager: EditorManager
  vault: Vault | null
  notes: NoteMeta[]
  folder_paths: string[]
  expanded_paths: Set<string>
  load_states: Map<string, FolderLoadState>
  open_note_title: string
  open_note: OpenNoteState | null
  sidebar_open: boolean
  selected_folder_path: string
  current_theme: ThemeMode
  link_syntax: EditorSettings['link_syntax']
  actions: Pick<
    AppShellActions,
    | 'handle_theme_change'
    | 'open_note'
    | 'open_wiki_link'
    | 'create_new_note'
    | 'request_create_folder'
    | 'markdown_change'
    | 'dirty_state_change'
    | 'request_delete'
    | 'request_rename'
    | 'request_delete_folder'
    | 'request_rename_folder'
    | 'open_settings'
    | 'toggle_sidebar'
    | 'select_folder_path'
    | 'toggle_filetree_folder'
    | 'retry_load_folder'
    | 'collapse_all_folders'
  >
}

export type AppSidebarModel = {
  editor_manager: EditorManager
  vault: Vault | null
  notes: NoteMeta[]
  folder_paths: string[]
  expanded_paths: Set<string>
  load_states: Map<string, FolderLoadState>
  open_note_title: string
  open_note: OpenNoteState | null
  sidebar_open: boolean
  selected_folder_path: string
  current_theme: ThemeMode
  link_syntax: EditorSettings['link_syntax']
}

export type AppSidebarOps = {
  on_theme_change: (theme: ThemeMode) => void
  on_open_note: (note_path: string) => void
  on_wiki_link_click: (note_path: string) => void
  on_create_note: () => void
  on_request_create_folder: (parent_path: string) => void
  on_markdown_change: (markdown: string) => void
  on_dirty_state_change: (is_dirty: boolean) => void
  on_request_delete_note: (note: NoteMeta) => void
  on_request_rename_note: (note: NoteMeta) => void
  on_request_delete_folder: (folder_path: string) => void
  on_request_rename_folder: (folder_path: string) => void
  on_open_settings: () => void
  on_toggle_sidebar: () => void
  on_select_folder_path: (path: string) => void
  on_toggle_folder: (path: string) => void
  on_retry_load: (path: string) => void
  on_collapse_all: () => void
}

export type AppSidebarProps = {
  model: AppSidebarModel
  ops: AppSidebarOps
}

export function build_app_sidebar_props(input: AppSidebarViewModelInput): AppSidebarProps {
  const {
    editor_manager,
    vault,
    notes,
    folder_paths,
    expanded_paths,
    load_states,
    open_note_title,
    open_note,
    sidebar_open,
    selected_folder_path,
    current_theme,
    link_syntax,
    actions
  } = input

  return {
    model: {
      editor_manager,
      vault,
      notes,
      folder_paths,
      expanded_paths,
      load_states,
      open_note_title,
      open_note,
      sidebar_open,
      selected_folder_path,
      current_theme,
      link_syntax
    },
    ops: {
      on_theme_change: actions.handle_theme_change,
      on_open_note: actions.open_note,
      on_wiki_link_click: actions.open_wiki_link,
      on_create_note: actions.create_new_note,
      on_request_create_folder: actions.request_create_folder,
      on_markdown_change: actions.markdown_change,
      on_dirty_state_change: actions.dirty_state_change,
      on_request_delete_note: actions.request_delete,
      on_request_rename_note: actions.request_rename,
      on_request_delete_folder: actions.request_delete_folder,
      on_request_rename_folder: actions.request_rename_folder,
      on_open_settings: actions.open_settings,
      on_toggle_sidebar: actions.toggle_sidebar,
      on_select_folder_path: actions.select_folder_path,
      on_toggle_folder: actions.toggle_filetree_folder,
      on_retry_load: actions.retry_load_folder,
      on_collapse_all: actions.collapse_all_folders
    }
  }
}
