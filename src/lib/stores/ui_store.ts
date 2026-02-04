import type { StoreHandle } from './store_handle'
import { create_store } from './create_store.svelte'
import type { EditorSettings } from '$lib/types/editor_settings'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'
import type { ThemeMode } from '$lib/types/theme'

export type UIState = {
  theme: ThemeMode
  sidebar_open: boolean
  selected_folder_path: string
  editor_settings: EditorSettings
  system_dialog_open: boolean
}

export type UIActions = {
  set_theme: (theme: ThemeMode) => void
  toggle_sidebar: () => void
  set_sidebar_open: (open: boolean) => void
  set_selected_folder_path: (path: string) => void
  set_editor_settings: (settings: EditorSettings) => void
  set_system_dialog_open: (open: boolean) => void
}

export type UIStore = StoreHandle<UIState, UIActions>

export function create_ui_store(): UIStore {
  return create_store<UIState, UIActions>(
    {
      theme: 'system',
      sidebar_open: true,
      selected_folder_path: '',
      editor_settings: DEFAULT_EDITOR_SETTINGS,
      system_dialog_open: false
    },
    (get, set) => ({
      set_theme: (theme) => {
        set({ ...get(), theme })
      },

      toggle_sidebar: () => {
        const state = get()
        set({ ...state, sidebar_open: !state.sidebar_open })
      },

      set_sidebar_open: (open) => {
        set({ ...get(), sidebar_open: open })
      },

      set_selected_folder_path: (path) => {
        set({ ...get(), selected_folder_path: path })
      },

      set_editor_settings: (editor_settings) => {
        set({ ...get(), editor_settings })
      },

      set_system_dialog_open: (system_dialog_open) => {
        set({ ...get(), system_dialog_open })
      }
    })
  )
}
