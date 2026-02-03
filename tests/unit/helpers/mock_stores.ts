import type { AppStores } from '$lib/stores/create_app_stores'
import type { VaultStore, VaultState, VaultActions } from '$lib/stores/vault_store'
import type { NotesStore, NotesState, NotesActions } from '$lib/stores/notes_store'
import type { EditorStore, EditorState, EditorActions } from '$lib/stores/editor_store'
import type { UIStore, UIState, UIActions } from '$lib/stores/ui_store'
import type { StoreHandle } from '$lib/stores/store_handle'
import type { NoteId, NotePath } from '$lib/types/ids'
import { ensure_open_note, create_untitled_open_note_in_folder } from '$lib/operations/ensure_open_note'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

function create_mock_store<TState, TActions>(
  initial_state: TState,
  create_actions: (get: () => TState, set: (s: TState) => void) => TActions
): StoreHandle<TState, TActions> {
  let state = initial_state
  const listeners = new Set<(s: TState) => void>()

  const get = (): TState => state
  const set = (next: TState): void => {
    state = next
    listeners.forEach(fn => fn(state))
  }

  return {
    get_snapshot: get,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    actions: create_actions(get, set)
  }
}

export function create_mock_vault_store(): VaultStore {
  return create_mock_store<VaultState, VaultActions>(
    {
      vault: null,
      recent_vaults: []
    },
    (get, set) => ({
      set_vault: (vault) => {
        set({ ...get(), vault })
      },
      clear_vault: () => {
        set({ ...get(), vault: null })
      },
      set_recent_vaults: (recent_vaults) => {
        set({ ...get(), recent_vaults })
      }
    })
  )
}

export function create_mock_notes_store(): NotesStore {
  return create_mock_store<NotesState, NotesActions>(
    {
      notes: [],
      folder_paths: []
    },
    (get, set) => ({
      set_notes: (notes) => {
        set({ ...get(), notes })
      },

      add_note: (note) => {
        const state = get()
        const existing = state.notes.find(n => n.id === note.id)
        if (existing) return
        const updated = [...state.notes, note]
        updated.sort((a, b) => a.path.localeCompare(b.path))
        set({ ...state, notes: updated })
      },

      remove_note: (note_id) => {
        const state = get()
        set({ ...state, notes: state.notes.filter(n => n.id !== note_id) })
      },

      rename_note: (old_path, new_path) => {
        const state = get()
        const normalized_new = new_path.endsWith('.md') ? new_path : `${new_path}.md`
        const parts = normalized_new.split('/')
        const leaf = parts[parts.length - 1] ?? ''
        const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

        const updated = state.notes.map(n => {
          if (n.path !== old_path) return n
          return { ...n, id: normalized_new as NoteId, path: normalized_new as NotePath, title }
        })
        updated.sort((a, b) => a.path.localeCompare(b.path))
        set({ ...state, notes: updated })
      },

      set_folder_paths: (folder_paths) => {
        set({ ...get(), folder_paths })
      },

      add_folder_path: (path) => {
        const state = get()
        if (state.folder_paths.includes(path)) return
        set({ ...state, folder_paths: [...state.folder_paths, path] })
      },

      remove_folder: (folder_path) => {
        const state = get()
        const prefix = folder_path + '/'
        const updated_notes = state.notes.filter(note => !note.path.startsWith(prefix))
        const updated_folders = state.folder_paths.filter(fp => fp !== folder_path && !fp.startsWith(prefix))
        set({ notes: updated_notes, folder_paths: updated_folders })
      },

      rename_folder: (old_path, new_path) => {
        const state = get()
        const old_prefix = old_path + '/'
        const new_prefix = new_path + '/'

        const updated_notes = state.notes.map(note => {
          if (note.path.startsWith(old_prefix)) {
            const updated_path = new_prefix + note.path.slice(old_prefix.length)
            return { ...note, id: updated_path as NoteId, path: updated_path as NotePath }
          }
          return note
        })

        const updated_folders = state.folder_paths.map(fp => {
          if (fp === old_path) return new_path
          if (fp.startsWith(old_prefix)) return new_prefix + fp.slice(old_prefix.length)
          return fp
        })

        set({ notes: updated_notes, folder_paths: updated_folders })
      },

      merge_folder_contents: (folder_path, contents) => {
        const state = get()
        const existing_notes_map = new Map(state.notes.map(n => [n.id, n]))

        for (const note of contents.notes) {
          existing_notes_map.set(note.id, note)
        }

        const merged_notes = Array.from(existing_notes_map.values())
        merged_notes.sort((a, b) => a.path.localeCompare(b.path))

        const existing_folders = new Set(state.folder_paths)
        for (const subfolder of contents.subfolders) {
          existing_folders.add(subfolder)
        }
        if (folder_path) {
          existing_folders.add(folder_path)
        }

        const merged_folders = Array.from(existing_folders).sort((a, b) => a.localeCompare(b))
        set({ notes: merged_notes, folder_paths: merged_folders })
      }
    })
  )
}

export function create_mock_editor_store(): EditorStore {
  return create_mock_store<EditorState, EditorActions>(
    {
      open_note: null
    },
    (get, set) => ({
      set_open_note: (open_note) => {
        set({ open_note })
      },

      clear_open_note: () => {
        set({ open_note: null })
      },

      update_markdown: (markdown) => {
        const state = get()
        if (!state.open_note) return
        set({ open_note: { ...state.open_note, markdown } })
      },

      update_dirty_state: (is_dirty) => {
        const state = get()
        if (!state.open_note) return
        set({ open_note: { ...state.open_note, is_dirty } })
      },

      update_path: (new_path) => {
        const state = get()
        if (!state.open_note) return

        const parts = new_path.split('/')
        const leaf = parts[parts.length - 1] ?? ''
        const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

        set({
          open_note: {
            ...state.open_note,
            meta: { ...state.open_note.meta, id: new_path as NoteId, path: new_path, title }
          }
        })
      },

      update_path_prefix: (old_prefix, new_prefix) => {
        const state = get()
        if (!state.open_note) return

        const current_path = state.open_note.meta.path
        if (!current_path.startsWith(old_prefix)) return

        const new_path = new_prefix + current_path.slice(old_prefix.length)
        const parts = new_path.split('/')
        const leaf = parts[parts.length - 1] ?? ''
        const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

        set({
          open_note: {
            ...state.open_note,
            meta: { ...state.open_note.meta, id: new_path as NoteId, path: new_path as NotePath, title }
          }
        })
      },

      ensure_open_note: (vault, notes, now_ms) => {
        const state = get()
        const result = ensure_open_note({
          vault,
          notes,
          open_note: state.open_note,
          now_ms
        })
        set({ open_note: result })
      },

      create_new_note_in_folder: (notes, folder_prefix, now_ms) => {
        const new_note = create_untitled_open_note_in_folder({
          notes,
          folder_prefix,
          now_ms
        })
        set({ open_note: new_note })
      }
    })
  )
}

export function create_mock_ui_store(): UIStore {
  return create_mock_store<UIState, UIActions>(
    {
      theme: 'system',
      sidebar_open: true,
      selected_folder_path: '',
      editor_settings: DEFAULT_EDITOR_SETTINGS
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
      }
    })
  )
}

export function create_mock_stores(options?: { now_ms?: () => number }): AppStores {
  return {
    vault: create_mock_vault_store(),
    notes: create_mock_notes_store(),
    editor: create_mock_editor_store(),
    ui: create_mock_ui_store(),
    now_ms: options?.now_ms ?? (() => Date.now())
  }
}
