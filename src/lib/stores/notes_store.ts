import type { StoreHandle } from './store_handle'
import type { NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { FolderContents } from '$lib/types/filetree'
import { create_store } from './create_store.svelte'

export type NotesState = {
  notes: NoteMeta[]
  folder_paths: string[]
}

export type NotesActions = {
  set_notes: (notes: NoteMeta[]) => void
  add_note: (note: NoteMeta) => void
  remove_note: (note_id: NoteId) => void
  rename_note: (old_path: NotePath, new_path: NotePath) => void
  set_folder_paths: (paths: string[]) => void
  add_folder_path: (path: string) => void
  remove_folder: (path: string) => void
  rename_folder: (old_path: string, new_path: string) => void
  merge_folder_contents: (folder_path: string, contents: FolderContents) => void
}

export type NotesStore = StoreHandle<NotesState, NotesActions>

export function create_notes_store(): NotesStore {
  return create_store<NotesState, NotesActions>(
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
