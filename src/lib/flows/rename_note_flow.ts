import { setup, assign, fromPromise } from 'xstate'
import { rename_note } from '$lib/operations/rename_note'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type RenameNotePorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  note_to_rename: NoteMeta | null
  vault_id: VaultId | null
  new_path: NotePath | null
  is_note_currently_open: boolean
  error: string | null
  target_exists: boolean
  ports: RenameNotePorts
  dispatch: AppStateDispatch
}

export type RenameNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_RENAME'; vault_id: VaultId; note: NoteMeta; is_note_currently_open: boolean }
  | { type: 'UPDATE_NEW_PATH'; path: NotePath }
  | { type: 'CONFIRM' }
  | { type: 'CONFIRM_OVERWRITE' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type RenameNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: RenameNotePorts
  dispatch: AppStateDispatch
}

export const rename_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    check_path_exists: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: RenameNotePorts
          vault_id: VaultId
          new_path: NotePath
        }
      }) => {
        const { ports, vault_id, new_path } = input
        const notes = await ports.notes.list_notes(vault_id)
        return notes.some(note => note.path === new_path)
      }
    ),
    perform_rename: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: RenameNotePorts
          dispatch: AppStateDispatch
          vault_id: VaultId
          note: NoteMeta
          new_path: NotePath
          is_note_currently_open: boolean
        }
      }) => {
        const { ports, dispatch, vault_id, note, new_path, is_note_currently_open } = input

        await rename_note(ports, { vault_id, from: note.path, to: new_path })

        const notes = await ports.notes.list_notes(vault_id)
        dispatch({ type: 'UPDATE_NOTES_LIST', notes })

        if (is_note_currently_open) {
          dispatch({ type: 'UPDATE_OPEN_NOTE_PATH', path: new_path })
        }

        void ports.index.build_index(vault_id)
      }
    )
  }
}).createMachine({
  id: 'rename_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    note_to_rename: null,
    vault_id: null,
    new_path: null,
    is_note_currently_open: false,
    error: null,
    target_exists: false,
    ports: input.ports,
    dispatch: input.dispatch
  }),
  states: {
    idle: {
      on: {
        REQUEST_RENAME: {
          target: 'confirming',
          actions: assign({
            note_to_rename: ({ event }) => event.note,
            vault_id: ({ event }) => event.vault_id,
            is_note_currently_open: ({ event }) => event.is_note_currently_open,
            new_path: ({ event }) => event.note.path,
            error: () => null,
            target_exists: () => false
          })
        }
      }
    },
    confirming: {
      on: {
        UPDATE_NEW_PATH: {
          actions: assign({
            new_path: ({ event }) => event.path
          })
        },
        CONFIRM: 'checking_conflict',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_rename: () => null,
            vault_id: () => null,
            new_path: () => null,
            is_note_currently_open: () => false,
            error: () => null,
            target_exists: () => false
          })
        }
      }
    },
    checking_conflict: {
      invoke: {
        src: 'check_path_exists',
        input: ({ context }) => ({
          ports: context.ports,
          vault_id: context.vault_id!,
          new_path: context.new_path!
        }),
        onDone: {
          target: 'conflict_check_done',
          actions: assign({
            target_exists: ({ event }) => event.output
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
    conflict_check_done: {
      always: [
        { target: 'conflict_confirm', guard: ({ context }) => context.target_exists },
        { target: 'renaming' }
      ]
    },
    conflict_confirm: {
      on: {
        CONFIRM_OVERWRITE: 'renaming',
        CANCEL: {
          target: 'confirming',
          actions: assign({
            target_exists: () => false
          })
        }
      }
    },
    renaming: {
      invoke: {
        src: 'perform_rename',
        input: ({ context }) => ({
          ports: context.ports,
          dispatch: context.dispatch,
          vault_id: context.vault_id!,
          note: context.note_to_rename!,
          new_path: context.new_path!,
          is_note_currently_open: context.is_note_currently_open
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            note_to_rename: () => null,
            vault_id: () => null,
            new_path: () => null,
            is_note_currently_open: () => false,
            target_exists: () => false
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
        RETRY: 'checking_conflict',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_rename: () => null,
            vault_id: () => null,
            new_path: () => null,
            is_note_currently_open: () => false,
            error: () => null,
            target_exists: () => false
          })
        }
      }
    }
  }
})
