import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { AppStateEvents, AppStateContext } from '$lib/state/app_state_machine'
import type { FlowSnapshot } from '$lib/flows/flow_handle'
import { save_note_with_untitled_handling } from '$lib/operations/save_note_operation'

type SaveNotePorts = {
  notes: NotesPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type GetAppStateSnapshot = () => FlowSnapshot<AppStateContext>

type FlowContext = {
  error: string | null
  ports: SaveNotePorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
  on_save_complete: (() => void) | undefined
}

export type SaveNoteFlowContext = FlowContext

type FlowEvents = { type: 'REQUEST_SAVE' } | { type: 'RETRY' } | { type: 'CANCEL' }

export type SaveNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: SaveNotePorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
  on_save_complete?: () => void
}

export const save_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_save: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: SaveNotePorts
          dispatch: AppStateDispatch
          get_app_state_snapshot: GetAppStateSnapshot
        }
      }) => {
        const { ports, dispatch, get_app_state_snapshot } = input

        const app_snapshot = get_app_state_snapshot()
        const { vault, open_note } = app_snapshot.context

        if (!vault || !open_note) return

        const result = await save_note_with_untitled_handling(
          { notes: ports.notes },
          { vault_id: vault.id, note: open_note }
        )

        if (result.needs_path_update) {
          dispatch({ type: 'UPDATE_OPEN_NOTE_PATH', path: result.final_note_id })
        }

        const notes = await ports.notes.list_notes(vault.id)
        dispatch({ type: 'UPDATE_NOTES_LIST', notes })
      }
    )
  }
}).createMachine({
  id: 'save_note_flow',
  initial: 'idle',
  context: ({ input }): FlowContext => ({
    error: null,
    ports: input.ports,
    dispatch: input.dispatch,
    get_app_state_snapshot: input.get_app_state_snapshot,
    on_save_complete: input.on_save_complete
  }),
  states: {
    idle: {
      on: {
        REQUEST_SAVE: {
          target: 'saving',
          actions: assign({
            error: () => null
          })
        }
      }
    },
    saving: {
      invoke: {
        src: 'perform_save',
        input: ({ context }) => ({
          ports: context.ports,
          dispatch: context.dispatch,
          get_app_state_snapshot: context.get_app_state_snapshot
        }),
        onDone: {
          target: 'idle',
          actions: ({ context }) => {
            context.on_save_complete?.()
          }
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
        RETRY: {
          target: 'saving',
          actions: assign({
            error: () => null
          })
        },
        CANCEL: {
          target: 'idle',
          actions: assign({
            error: () => null
          })
        }
      }
    }
  }
})
