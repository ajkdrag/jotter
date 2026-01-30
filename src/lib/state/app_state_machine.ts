// The app_state_machine is the Model.
// It should be "dumb" and "pure." It doesn't fetch files, it doesn't show dialogs, and it doesn't "invoke" async processes. 
// It just reacts to events and calculates the next state

import { setup, assign } from 'xstate'
import { ensure_open_note } from '$lib/operations/ensure_open_note'
import type { MarkdownText, NoteId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'

export type ThemeMode = 'light' | 'dark' | 'system'

export type AppStateContext = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  folder_paths: string[]
  open_note: OpenNoteState | null
  theme: ThemeMode
  now_ms: () => number
}

export type AppStateEvents =
  | { type: 'RESET_APP' }
  | { type: 'SET_RECENT_VAULTS'; recent_vaults: Vault[] }
  | { type: 'SET_ACTIVE_VAULT'; vault: Vault; notes: NoteMeta[]; folder_paths?: string[] }
  | { type: 'CLEAR_ACTIVE_VAULT' }
  | { type: 'UPDATE_NOTES_LIST'; notes: NoteMeta[] }
  | { type: 'UPDATE_FOLDER_LIST'; folder_paths: string[] }
  | { type: 'SET_OPEN_NOTE'; open_note: OpenNoteState }
  | { type: 'CLEAR_OPEN_NOTE' }
  | { type: 'UPDATE_OPEN_NOTE_PATH'; path: NoteId }
  | { type: 'NOTIFY_MARKDOWN_CHANGED'; markdown: MarkdownText }
  | { type: 'NOTIFY_DIRTY_STATE_CHANGED'; is_dirty: boolean }
  | { type: 'COMMAND_ENSURE_OPEN_NOTE' }
  | { type: 'SET_THEME'; theme: ThemeMode }

export type AppStateInput = { now_ms?: () => number }

export function reset_app(context: AppStateContext): AppStateContext {
  return {
    ...context,
    vault: null,
    recent_vaults: [],
    notes: [],
    folder_paths: [],
    open_note: null,
    theme: 'system'
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
        SET_THEME: {
          actions: assign({
            theme: ({ event }) => event.theme
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
          actions: assign(({ context }) => ({
            ...context,
            vault: null,
            notes: [],
            folder_paths: [],
            open_note: null
          }))
        },
        UPDATE_NOTES_LIST: {
          actions: assign(({ event, context }) => ({
            ...context,
            notes: event.notes
          }))
        },
        UPDATE_FOLDER_LIST: {
          actions: assign(({ event, context }) => ({
            ...context,
            folder_paths: event.folder_paths
          }))
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
        NOTIFY_MARKDOWN_CHANGED: {
          actions: assign(({ event, context }) => update_markdown(context, event.markdown))
        },
        NOTIFY_DIRTY_STATE_CHANGED: {
          actions: assign(({ event, context }) => update_dirty_state(context, event.is_dirty))
        },
        COMMAND_ENSURE_OPEN_NOTE: {
          actions: assign(({ context }) => ensure_open_note_in_context(context))
        },
        SET_THEME: {
          actions: assign({
            theme: ({ event }) => event.theme
          })
        }
      }
    }
  }
})


