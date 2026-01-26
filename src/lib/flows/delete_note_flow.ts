import { setup, assign, fromPromise } from 'xstate'
import { delete_note } from '$lib/operations/delete_note'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { VaultId } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/flows/app_state_machine'

type DeleteNotePorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  note_to_delete: NoteMeta | null
  vault_id: VaultId | null
  is_note_currently_open: boolean
  error: string | null
  ports: DeleteNotePorts
  dispatch: AppStateDispatch
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
  dispatch: AppStateDispatch
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
          dispatch: AppStateDispatch
          vault_id: VaultId
          note: NoteMeta
          is_note_currently_open: boolean
        }
      }) => {
        const { ports, dispatch, vault_id, note } = input

        await delete_note(ports, { vault_id, note_id: note.id })

        const notes = await ports.notes.list_notes(vault_id)
        dispatch({ type: 'UPDATE_NOTES_LIST', notes })

        if (input.is_note_currently_open) dispatch({ type: 'CLEAR_OPEN_NOTE' })
        dispatch({ type: 'COMMAND_ENSURE_OPEN_NOTE' })

        void ports.index.build_index(vault_id)
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
    dispatch: input.dispatch
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
        input: ({ context }) => ({
          ports: context.ports,
          dispatch: context.dispatch,
          vault_id: context.vault_id!,
          note: context.note_to_delete!,
          is_note_currently_open: context.is_note_currently_open
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            note_to_delete: () => null,
            vault_id: () => null,
            is_note_currently_open: () => false
          })
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
