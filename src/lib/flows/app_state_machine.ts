import { setup, assign } from 'xstate'
import { ensure_open_note } from '$lib/operations/ensure_open_note'
import type { MarkdownText, NoteId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'

export type AppStateContext = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
  now_ms: () => number
}

export type AppStateEvents =
  | { type: 'RESET_APP' }
  | { type: 'SET_RECENT_VAULTS'; recent_vaults: Vault[] }
  | { type: 'SET_ACTIVE_VAULT'; vault: Vault; notes: NoteMeta[] }
  | { type: 'CLEAR_ACTIVE_VAULT' }
  | { type: 'UPDATE_NOTES_LIST'; notes: NoteMeta[] }
  | { type: 'SET_OPEN_NOTE'; open_note: OpenNoteState }
  | { type: 'CLEAR_OPEN_NOTE' }
  | { type: 'NOTIFY_MARKDOWN_CHANGED'; markdown: MarkdownText }
  | { type: 'NOTIFY_REVISION_CHANGED'; note_id: NoteId; revision_id: number; sticky_dirty: boolean }
  | { type: 'COMMAND_ENSURE_OPEN_NOTE' }

export type AppStateInput = { now_ms?: () => number }

function ensure_open_note_in_context(context: AppStateContext): AppStateContext {
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
    open_note: null,
    now_ms: input.now_ms ?? (() => Date.now())
  }),
  states: {
    no_vault: {
      on: {
        RESET_APP: {
          actions: assign({
            vault: () => null,
            recent_vaults: () => [],
            notes: () => [],
            open_note: () => null
          })
        },
        SET_RECENT_VAULTS: {
          actions: assign({
            recent_vaults: ({ event }) => event.recent_vaults
          })
        },
        SET_ACTIVE_VAULT: {
          target: 'vault_open',
          actions: assign(({ event, context }) =>
            ensure_open_note_in_context({
              ...context,
              vault: event.vault,
              notes: event.notes,
              open_note: null
            })
          )
        }
      }
    },
    vault_open: {
      on: {
        RESET_APP: {
          target: 'no_vault',
          actions: assign({
            vault: () => null,
            recent_vaults: () => [],
            notes: () => [],
            open_note: () => null
          })
        },
        SET_RECENT_VAULTS: {
          actions: assign({
            recent_vaults: ({ event }) => event.recent_vaults
          })
        },
        SET_ACTIVE_VAULT: {
          actions: assign(({ event, context }) =>
            ensure_open_note_in_context({
              ...context,
              vault: event.vault,
              notes: event.notes,
              open_note: null
            })
          )
        },
        CLEAR_ACTIVE_VAULT: {
          target: 'no_vault',
          actions: assign({
            vault: () => null,
            notes: () => [],
            open_note: () => null
          })
        },
        UPDATE_NOTES_LIST: {
          actions: assign(({ event, context }) => ({
            ...context,
            notes: event.notes
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
        NOTIFY_MARKDOWN_CHANGED: {
          actions: assign(({ event, context }) => {
            const open_note = context.open_note
            if (!open_note) return context
            return {
              ...context,
              open_note: {
                ...open_note,
                markdown: event.markdown
              }
            }
          })
        },
        NOTIFY_REVISION_CHANGED: {
          actions: assign(({ event, context }) => {
            const open_note = context.open_note
            if (!open_note) return context
            if (open_note.meta.id !== event.note_id) return context

            const dirty = event.sticky_dirty || event.revision_id !== open_note.saved_revision_id

            return {
              ...context,
              open_note: {
                ...open_note,
                revision_id: event.revision_id,
                sticky_dirty: event.sticky_dirty,
                dirty
              }
            }
          })
        },
        COMMAND_ENSURE_OPEN_NOTE: {
          actions: assign(({ context }) => ensure_open_note_in_context(context))
        }
      }
    }
  }
})


