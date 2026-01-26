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
  | { type: 'RESET' }
  | { type: 'RECENT_VAULTS_SET'; recent_vaults: Vault[] }
  | { type: 'VAULT_SET'; vault: Vault; notes: NoteMeta[] }
  | { type: 'VAULT_CLEARED' }
  | { type: 'NOTES_SET'; notes: NoteMeta[] }
  | { type: 'OPEN_NOTE_SET'; open_note: OpenNoteState }
  | { type: 'OPEN_NOTE_CLEARED' }
  | { type: 'OPEN_NOTE_MARKDOWN_CHANGED'; markdown: MarkdownText }
  | { type: 'OPEN_NOTE_REVISION_CHANGED'; note_id: NoteId; revision_id: number; sticky_dirty: boolean }
  | { type: 'ENSURE_OPEN_NOTE' }

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
        RESET: {
          actions: assign({
            vault: () => null,
            recent_vaults: () => [],
            notes: () => [],
            open_note: () => null
          })
        },
        RECENT_VAULTS_SET: {
          actions: assign({
            recent_vaults: ({ event }) => event.recent_vaults
          })
        },
        VAULT_SET: {
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
        RESET: {
          target: 'no_vault',
          actions: assign({
            vault: () => null,
            recent_vaults: () => [],
            notes: () => [],
            open_note: () => null
          })
        },
        RECENT_VAULTS_SET: {
          actions: assign({
            recent_vaults: ({ event }) => event.recent_vaults
          })
        },
        VAULT_SET: {
          actions: assign(({ event, context }) =>
            ensure_open_note_in_context({
              ...context,
              vault: event.vault,
              notes: event.notes,
              open_note: null
            })
          )
        },
        VAULT_CLEARED: {
          target: 'no_vault',
          actions: assign({
            vault: () => null,
            notes: () => [],
            open_note: () => null
          })
        },
        NOTES_SET: {
          actions: assign(({ event, context }) => ({
            ...context,
            notes: event.notes
          }))
        },
        OPEN_NOTE_SET: {
          actions: assign({
            open_note: ({ event }) => event.open_note
          })
        },
        OPEN_NOTE_CLEARED: {
          actions: assign({
            open_note: () => null
          })
        },
        OPEN_NOTE_MARKDOWN_CHANGED: {
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
        OPEN_NOTE_REVISION_CHANGED: {
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
        ENSURE_OPEN_NOTE: {
          actions: assign(({ context }) => ensure_open_note_in_context(context))
        }
      }
    }
  }
})


