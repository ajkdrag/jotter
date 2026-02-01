import { setup, assign } from 'xstate'
import { ensure_open_note, create_untitled_open_note_in_folder } from '$lib/operations/ensure_open_note'
import type { MarkdownText, NoteId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import type { FolderContents } from '$lib/types/filetree'

export type ThemeMode = 'light' | 'dark' | 'system'

export type AppStateContext = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  folder_paths: string[]
  open_note: OpenNoteState | null
  theme: ThemeMode
  sidebar_open: boolean
  selected_folder_path: string
  now_ms: () => number
}

export type AppStateEvents =
  | { type: 'RESET_APP' }
  | { type: 'SET_RECENT_VAULTS'; recent_vaults: Vault[] }
  | { type: 'SET_ACTIVE_VAULT'; vault: Vault; notes: NoteMeta[]; folder_paths?: string[] }
  | { type: 'CLEAR_ACTIVE_VAULT' }
  | { type: 'UPDATE_NOTES_LIST'; notes: NoteMeta[] }
  | { type: 'UPDATE_FOLDER_LIST'; folder_paths: string[] }
  | { type: 'UPDATE_FOLDERS_LIST'; folders: string[] }
  | { type: 'RENAME_FOLDER_IN_STATE'; old_path: string; new_path: string }
  | { type: 'REMOVE_FOLDER_FROM_STATE'; folder_path: string }
  | { type: 'SET_OPEN_NOTE'; open_note: OpenNoteState }
  | { type: 'CLEAR_OPEN_NOTE' }
  | { type: 'UPDATE_OPEN_NOTE_PATH'; path: NoteId }
  | { type: 'UPDATE_OPEN_NOTE_PATH_PREFIX'; old_prefix: string; new_prefix: string }
  | { type: 'NOTIFY_MARKDOWN_CHANGED'; markdown: MarkdownText }
  | { type: 'NOTIFY_DIRTY_STATE_CHANGED'; is_dirty: boolean }
  | { type: 'COMMAND_ENSURE_OPEN_NOTE' }
  | { type: 'CREATE_NEW_NOTE_IN_CURRENT_FOLDER' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_OPEN'; open: boolean }
  | { type: 'SET_SELECTED_FOLDER_PATH'; path: string }
  | { type: 'MERGE_FOLDER_CONTENTS'; folder_path: string; contents: FolderContents }
  | { type: 'ADD_FOLDER_PATH'; folder_path: string }

export type AppStateInput = { now_ms?: () => number }

export function reset_app(context: AppStateContext): AppStateContext {
  return {
    ...context,
    vault: null,
    recent_vaults: [],
    notes: [],
    folder_paths: [],
    open_note: null,
    theme: 'system',
    sidebar_open: true,
    selected_folder_path: ''
  }
}

export function set_active_vault(
  context: AppStateContext,
  vault: Vault,
  notes: NoteMeta[],
  folder_paths: string[] = []
): AppStateContext {
  return ensure_open_note_in_context({
    ...context,
    vault,
    notes,
    folder_paths,
    open_note: null
  })
}

export function update_markdown(context: AppStateContext, markdown: MarkdownText): AppStateContext {
  if (!context.open_note) return context
  return {
    ...context,
    open_note: { ...context.open_note, markdown }
  }
}

export function update_dirty_state(context: AppStateContext, is_dirty: boolean): AppStateContext {
  if (!context.open_note) return context
  return {
    ...context,
    open_note: { ...context.open_note, is_dirty }
  }
}

export function ensure_open_note_in_context(context: AppStateContext): AppStateContext {
  return {
    ...context,
    open_note: ensure_open_note({
      vault: context.vault,
      notes: context.notes,
      open_note: context.open_note,
      now_ms: context.now_ms()
    })
  }
}

export function update_open_note_path(context: AppStateContext, new_path: NoteId): AppStateContext {
  const open_note = context.open_note
  if (!open_note) return context

  const parts = new_path.split('/')
  const leaf = parts[parts.length - 1] ?? ''
  const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

  return {
    ...context,
    open_note: {
      ...open_note,
      meta: { ...open_note.meta, id: new_path, path: new_path, title }
    }
  }
}

export function update_open_note_path_prefix(context: AppStateContext, old_prefix: string, new_prefix: string): AppStateContext {
  const open_note = context.open_note
  if (!open_note) return context

  const current_path = open_note.meta.path
  if (!current_path.startsWith(old_prefix)) return context

  const new_path = new_prefix + current_path.slice(old_prefix.length)
  const parts = new_path.split('/')
  const leaf = parts[parts.length - 1] ?? ''
  const title = leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf

  return {
    ...context,
    open_note: {
      ...open_note,
      meta: { ...open_note.meta, id: new_path as NoteId, path: new_path as NoteId, title }
    }
  }
}

export function rename_folder_in_state(context: AppStateContext, old_path: string, new_path: string): AppStateContext {
  const old_prefix = old_path + '/'
  const new_prefix = new_path + '/'

  const updated_notes = context.notes.map(note => {
    if (note.path.startsWith(old_prefix)) {
      const updated_path = new_prefix + note.path.slice(old_prefix.length)
      return { ...note, id: updated_path as NoteId, path: updated_path as NoteId }
    }
    return note
  })

  const updated_folders = context.folder_paths.map(fp => {
    if (fp === old_path) return new_path
    if (fp.startsWith(old_prefix)) return new_prefix + fp.slice(old_prefix.length)
    return fp
  })

  let result: AppStateContext = {
    ...context,
    notes: updated_notes,
    folder_paths: updated_folders
  }

  if (context.open_note?.meta.path.startsWith(old_prefix)) {
    result = update_open_note_path_prefix(result, old_prefix, new_prefix)
  }

  return result
}

export function remove_folder_from_state(context: AppStateContext, folder_path: string): AppStateContext {
  const prefix = folder_path + '/'

  const updated_notes = context.notes.filter(note => !note.path.startsWith(prefix))
  const updated_folders = context.folder_paths.filter(fp => fp !== folder_path && !fp.startsWith(prefix))

  return {
    ...context,
    notes: updated_notes,
    folder_paths: updated_folders
  }
}

export function create_new_note_in_current_folder(context: AppStateContext): AppStateContext {
  const new_note = create_untitled_open_note_in_folder({
    notes: context.notes,
    folder_prefix: context.selected_folder_path,
    now_ms: context.now_ms()
  })

  return { ...context, open_note: new_note }
}

export function merge_folder_contents(
  context: AppStateContext,
  folder_path: string,
  contents: FolderContents
): AppStateContext {
  const existing_notes_map = new Map(context.notes.map(n => [n.id, n]))

  for (const note of contents.notes) {
    existing_notes_map.set(note.id, note)
  }

  const merged_notes = Array.from(existing_notes_map.values())
  merged_notes.sort((a, b) => a.path.localeCompare(b.path))

  const existing_folders = new Set(context.folder_paths)
  for (const subfolder of contents.subfolders) {
    existing_folders.add(subfolder)
  }
  if (folder_path) {
    existing_folders.add(folder_path)
  }

  const merged_folders = Array.from(existing_folders).sort((a, b) => a.localeCompare(b))

  return {
    ...context,
    notes: merged_notes,
    folder_paths: merged_folders
  }
}

export const app_state_machine = setup({
  types: {
    context: {} as AppStateContext,
    events: {} as AppStateEvents,
    input: {} as AppStateInput
  }
}).createMachine({
  id: 'app_state',
  initial: 'no_vault',
  context: ({ input }) => ({
    vault: null,
    recent_vaults: [],
    notes: [],
    folder_paths: [],
    open_note: null,
    theme: 'system' as ThemeMode,
    sidebar_open: true,
    selected_folder_path: '',
    now_ms: input.now_ms ?? (() => Date.now())
  }),
  states: {
    no_vault: {
      on: {
        RESET_APP: {
          actions: assign(({ context }) => reset_app(context))
        },
        SET_RECENT_VAULTS: {
          actions: assign({
            recent_vaults: ({ event }) => event.recent_vaults
          })
        },
        SET_ACTIVE_VAULT: {
          target: 'vault_open',
          actions: assign(({ event, context }) =>
            set_active_vault(context, event.vault, event.notes, event.folder_paths ?? [])
          )
        },
        CREATE_NEW_NOTE_IN_CURRENT_FOLDER: {
          actions: assign(({ context }) => create_new_note_in_current_folder(context))
        },
        SET_THEME: {
          actions: assign({
            theme: ({ event }) => event.theme
          })
        },
        TOGGLE_SIDEBAR: {
          actions: assign({
            sidebar_open: ({ context }) => !context.sidebar_open
          })
        },
        SET_SIDEBAR_OPEN: {
          actions: assign({
            sidebar_open: ({ event }) => event.open
          })
        },
        SET_SELECTED_FOLDER_PATH: {
          actions: assign({
            selected_folder_path: ({ event }) => event.path
          })
        }
      }
    },
    vault_open: {
      on: {
        RESET_APP: {
          target: 'no_vault',
          actions: assign(({ context }) => reset_app(context))
        },
        SET_RECENT_VAULTS: {
          actions: assign({
            recent_vaults: ({ event }) => event.recent_vaults
          })
        },
        SET_ACTIVE_VAULT: {
          actions: assign(({ event, context }) =>
            set_active_vault(context, event.vault, event.notes, event.folder_paths ?? [])
          )
        },
        CLEAR_ACTIVE_VAULT: {
          target: 'no_vault',
          actions: assign({
            vault: null,
            notes: [],
            folder_paths: [],
            open_note: null
          })
        },
        UPDATE_NOTES_LIST: {
          actions: assign({
            notes: ({ event }) => event.notes
          })
        },
        UPDATE_FOLDER_LIST: {
          actions: assign({
            folder_paths: ({ event }) => event.folder_paths
          })
        },
        UPDATE_FOLDERS_LIST: {
          actions: assign({
            folder_paths: ({ event }) => event.folders
          })
        },
        RENAME_FOLDER_IN_STATE: {
          actions: assign(({ event, context }) => rename_folder_in_state(context, event.old_path, event.new_path))
        },
        REMOVE_FOLDER_FROM_STATE: {
          actions: assign(({ event, context }) => remove_folder_from_state(context, event.folder_path))
        },
        SET_OPEN_NOTE: {
          actions: assign({
            open_note: ({ event }) => event.open_note
          })
        },
        CLEAR_OPEN_NOTE: {
          actions: assign({
            open_note: () => null
          })
        },
        UPDATE_OPEN_NOTE_PATH: {
          actions: assign(({ event, context }) => update_open_note_path(context, event.path))
        },
        UPDATE_OPEN_NOTE_PATH_PREFIX: {
          actions: assign(({ event, context }) => update_open_note_path_prefix(context, event.old_prefix, event.new_prefix))
        },
        NOTIFY_MARKDOWN_CHANGED: {
          actions: assign(({ event, context }) => update_markdown(context, event.markdown))
        },
        NOTIFY_DIRTY_STATE_CHANGED: {
          actions: assign(({ event, context }) => update_dirty_state(context, event.is_dirty))
        },
        COMMAND_ENSURE_OPEN_NOTE: {
          actions: assign(({ context }) => ensure_open_note_in_context(context))
        },
        CREATE_NEW_NOTE_IN_CURRENT_FOLDER: {
          actions: assign(({ context }) => create_new_note_in_current_folder(context))
        },
        SET_THEME: {
          actions: assign({
            theme: ({ event }) => event.theme
          })
        },
        TOGGLE_SIDEBAR: {
          actions: assign({
            sidebar_open: ({ context }) => !context.sidebar_open
          })
        },
        SET_SIDEBAR_OPEN: {
          actions: assign({
            sidebar_open: ({ event }) => event.open
          })
        },
        SET_SELECTED_FOLDER_PATH: {
          actions: assign({
            selected_folder_path: ({ event }) => event.path
          })
        },
        MERGE_FOLDER_CONTENTS: {
          actions: assign(({ event, context }) =>
            merge_folder_contents(context, event.folder_path, event.contents)
          )
        },
        ADD_FOLDER_PATH: {
          actions: assign(({ event, context }) => {
            if (context.folder_paths.includes(event.folder_path)) return {}
            return { folder_paths: [...context.folder_paths, event.folder_path] }
          })
        }
      }
    }
  }
})
