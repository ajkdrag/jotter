import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import type { AppEvent } from '$lib/events/app_event'
import { delete_note_use_case } from '$lib/use_cases/delete_note_use_case'

type DeleteNotePorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type FlowContext = {
  note_to_delete: NoteMeta | null
  vault_id: VaultId | null
  is_note_currently_open: boolean
  error: string | null
  ports: DeleteNotePorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

export type DeleteNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_DELETE'; vault_id: VaultId; note: NoteMeta; is_note_currently_open: boolean }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type DeleteNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: DeleteNotePorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

export const delete_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_delete: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: DeleteNotePorts
          stores: AppStores
          vault_id: VaultId
          note: NoteMeta
          is_note_currently_open: boolean
          dispatch_many: (events: AppEvent[]) => void
          now_ms: () => number
        }
      }): Promise<AppEvent[]> => {
        const { ports, stores, vault_id, note, now_ms } = input

        return await delete_note_use_case(
          { notes: ports.notes, index: ports.index },
          {
            vault_id,
            note,
            is_note_currently_open: input.is_note_currently_open,
            current_vault: stores.vault.get_snapshot().vault,
            current_notes: stores.notes.get_snapshot().notes,
            current_open_note: stores.editor.get_snapshot().open_note,
            now_ms: now_ms()
          }
        )
      }
    )
  }
}).createMachine({
  id: 'delete_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    note_to_delete: null,
    vault_id: null,
    is_note_currently_open: false,
    error: null,
    ports: input.ports,
    stores: input.stores,
    dispatch_many: input.dispatch_many,
    now_ms: input.now_ms
  }),
  states: {
    idle: {
      on: {
        REQUEST_DELETE: {
          target: 'confirming',
          actions: assign({
            note_to_delete: ({ event }) => event.note,
            vault_id: ({ event }) => event.vault_id,
            is_note_currently_open: ({ event }) => event.is_note_currently_open,
            error: () => null
          })
        }
      }
    },
    confirming: {
      on: {
        CONFIRM: 'deleting',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_delete: () => null
          })
        }
      }
    },
    deleting: {
      invoke: {
        src: 'perform_delete',
        input: ({ context }) => {
          if (!context.vault_id) throw new Error('vault_id required in deleting state')
          if (!context.note_to_delete) throw new Error('note_to_delete required in deleting state')
          return {
            ports: context.ports,
            stores: context.stores,
            vault_id: context.vault_id,
            note: context.note_to_delete,
            is_note_currently_open: context.is_note_currently_open,
            dispatch_many: context.dispatch_many,
            now_ms: context.now_ms
          }
        },
        onDone: {
          target: 'idle',
          actions: [
            assign({
              note_to_delete: () => null,
              vault_id: () => null,
              is_note_currently_open: () => false
            }),
            ({ context, event }) => {
              context.dispatch_many(event.output)
            }
          ]
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error)
          })
        }
      }
    },
    error: {
      on: {
        RETRY: 'deleting',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_delete: () => null,
            vault_id: () => null,
            is_note_currently_open: () => false,
            error: () => null
          })
        }
      }
    }
  }
})
