import type { StoreHandle } from './store_handle'
import { create_store } from './create_store.svelte'
import type { EditorSettings } from '$lib/types/editor_settings'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'
import type { ThemeMode } from '$lib/types/theme'
import type { AppEvent } from '$lib/events/app_event'

export type UIState = {
  theme: ThemeMode
  sidebar_open: boolean
  selected_folder_path: string
  editor_settings: EditorSettings
  system_dialog_open: boolean
}

export type UIStore = StoreHandle<UIState, AppEvent>

export function create_ui_store(): UIStore {
  return create_store<UIState, AppEvent>(
    {
      theme: 'system',
      sidebar_open: true,
      selected_folder_path: '',
      editor_settings: DEFAULT_EDITOR_SETTINGS,
      system_dialog_open: false
    },
    (state, event) => {
      switch (event.type) {
        case 'ui_theme_set':
          return { ...state, theme: event.theme }
        case 'ui_sidebar_set':
          return { ...state, sidebar_open: event.open }
        case 'ui_selected_folder_set':
          return { ...state, selected_folder_path: event.path }
        case 'ui_editor_settings_set':
          return { ...state, editor_settings: event.settings }
        case 'ui_system_dialog_set':
          return { ...state, system_dialog_open: event.open }
        default:
          return state
      }
    }
  )
}
