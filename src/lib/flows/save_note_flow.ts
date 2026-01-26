import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId, NoteId, MarkdownText, NotePath } from '$lib/types/ids'
import { as_note_path } from '$lib/types/ids'
import type { AppStateEvents, AppStateContext } from '$lib/state/app_state_machine'
import type { FlowSnapshot } from '$lib/flows/flow_handle'

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
}

export type SaveNoteFlowContext = FlowContext

type FlowEvents = { type: 'REQUEST_SAVE' } | { type: 'RETRY' } | { type: 'CANCEL' }

export type SaveNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: SaveNotePorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
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
        if (!open_note.dirty) return

        const vault_id = vault.id
        const note_id = open_note.meta.id
        const note_path = open_note.meta.path
        const markdown = open_note.markdown
        const current_revision_id = open_note.revision_id

        const is_untitled = !note_path.endsWith('.md')

        let final_note_id: NoteId = note_id

        if (is_untitled) {
          const note_path = as_note_path(`${open_note.meta.title}.md`)
          const created_note = await ports.notes.create_note(vault_id, note_path, markdown)
          final_note_id = created_note.id

          dispatch({ type: 'UPDATE_OPEN_NOTE_PATH', path: final_note_id })
        } else {
          await ports.notes.write_note(vault_id, note_id, markdown)
        }

        const saved_at_ms = Date.now()
        dispatch({
          type: 'NOTE_SAVED',
          note_id: final_note_id,
          saved_revision_id: current_revision_id,
          saved_at_ms
        })

        const notes = await ports.notes.list_notes(vault_id)
        dispatch({ type: 'UPDATE_NOTES_LIST', notes })
      }
    )
  }
}).createMachine({
  id: 'save_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    ports: input.ports,
    dispatch: input.dispatch,
    get_app_state_snapshot: input.get_app_state_snapshot
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
          target: 'idle'
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
