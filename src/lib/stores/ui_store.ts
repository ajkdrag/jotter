import type { StoreHandle } from './store_handle'
import { create_store } from './create_store.svelte'

export type ThemeMode = 'light' | 'dark' | 'system'

export type UIState = {
  theme: ThemeMode
  sidebar_open: boolean
  selected_folder_path: string
}

export type UIActions = {
  set_theme: (theme: ThemeMode) => void
  toggle_sidebar: () => void
  set_sidebar_open: (open: boolean) => void
  set_selected_folder_path: (path: string) => void
}

export type UIStore = StoreHandle<UIState, UIActions>

export function create_ui_store(): UIStore {
  return create_store<UIState, UIActions>(
    {
      theme: 'system',
      sidebar_open: true,
      selected_folder_path: ''
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
      }
    })
  )
}
