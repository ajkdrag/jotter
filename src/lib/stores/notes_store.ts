import type { StoreHandle } from './store_handle'
import type { NoteId, NotePath } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { FolderContents } from '$lib/types/filetree'
import { create_store } from './create_store.svelte'
import type { AppEvent } from '$lib/events/app_event'

export type NotesState = {
  notes: NoteMeta[]
  folder_paths: string[]
}

export type NotesStore = StoreHandle<NotesState, AppEvent>

function add_note(state: NotesState, note: NoteMeta): NotesState {
  const existing = state.notes.find(n => n.id === note.id)
  if (existing) return state
  const updated = [...state.notes, note]
  updated.sort((a, b) => a.path.localeCompare(b.path))
  return { ...state, notes: updated }
}

function remove_note(state: NotesState, note_id: NoteId): NotesState {
  return { ...state, notes: state.notes.filter(n => n.id !== note_id) }
}

function rename_note(state: NotesState, old_path: NotePath, new_path: NotePath): NotesState {
  const normalized_new = new_path.endsWith('.md') ? new_path : `${new_path}.md`
  const parts = normalized_new.split('/')
  const leaf = parts[parts.length - 1] ?? ''
  const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

  const updated = state.notes.map(n => {
    if (n.path !== old_path) return n
    return { ...n, id: normalized_new as NoteId, path: normalized_new as NotePath, title }
  })
  updated.sort((a, b) => a.path.localeCompare(b.path))
  return { ...state, notes: updated }
}

function add_folder_path(state: NotesState, path: string): NotesState {
  if (state.folder_paths.includes(path)) return state
  return { ...state, folder_paths: [...state.folder_paths, path] }
}

function remove_folder(state: NotesState, folder_path: string): NotesState {
  const prefix = folder_path + '/'
  const updated_notes = state.notes.filter(note => !note.path.startsWith(prefix))
  const updated_folders = state.folder_paths.filter(fp => fp !== folder_path && !fp.startsWith(prefix))
  return { notes: updated_notes, folder_paths: updated_folders }
}

function rename_folder(state: NotesState, old_path: string, new_path: string): NotesState {
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

  return { notes: updated_notes, folder_paths: updated_folders }
}

function merge_folder_contents(state: NotesState, folder_path: string, contents: FolderContents): NotesState {
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
  return { notes: merged_notes, folder_paths: merged_folders }
}

export function create_notes_store(): NotesStore {
  return create_store<NotesState, AppEvent>(
    {
      notes: [],
      folder_paths: []
    },
    (state, event) => {
      switch (event.type) {
        case 'notes_set':
          return { ...state, notes: event.notes }
        case 'note_added':
          return add_note(state, event.note)
        case 'note_removed':
          return remove_note(state, event.note_id)
        case 'note_renamed':
          return rename_note(state, event.old_path, event.new_path)
        case 'folders_set':
          return { ...state, folder_paths: event.folder_paths }
        case 'folder_added':
          return add_folder_path(state, event.folder_path)
        case 'folder_removed':
          return remove_folder(state, event.folder_path)
        case 'folder_renamed':
          return rename_folder(state, event.old_path, event.new_path)
        case 'folder_contents_merged':
          return merge_folder_contents(state, event.folder_path, event.contents)
        default:
          return state
      }
    }
  )
}
