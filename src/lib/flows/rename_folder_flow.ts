import { setup, assign, fromPromise } from 'xstate'
import { rename_folder } from '$lib/operations/rename_folder'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type RenameFolderPorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  folder_path: string | null
  vault_id: VaultId | null
  new_path: string | null
  contains_open_note: boolean
  error: string | null
  ports: RenameFolderPorts
  dispatch: AppStateDispatch
}

export type RenameFolderFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_RENAME'; vault_id: VaultId; folder_path: string; contains_open_note: boolean }
  | { type: 'UPDATE_NEW_PATH'; path: string }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type RenameFolderFlowEvents = FlowEvents

type FlowInput = {
  ports: RenameFolderPorts
  dispatch: AppStateDispatch
}

export const rename_folder_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_rename: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: RenameFolderPorts
          dispatch: AppStateDispatch
          vault_id: VaultId
          folder_path: string
          new_path: string
        }
      }) => {
        const { ports, dispatch, vault_id, folder_path, new_path } = input

        await rename_folder(ports, { vault_id, from_path: folder_path, to_path: new_path })

        dispatch({ type: 'RENAME_FOLDER_IN_STATE', old_path: folder_path, new_path })

        void ports.index.build_index(vault_id)
      }
    )
  }
}).createMachine({
  id: 'rename_folder_flow',
  initial: 'idle',
  context: ({ input }) => ({
    folder_path: null,
    vault_id: null,
    new_path: null,
    contains_open_note: false,
    error: null,
    ports: input.ports,
    dispatch: input.dispatch
  }),
  states: {
    idle: {
      on: {
        REQUEST_RENAME: {
          target: 'confirming',
          actions: assign({
            folder_path: ({ event }) => event.folder_path,
            vault_id: ({ event }) => event.vault_id,
            contains_open_note: ({ event }) => event.contains_open_note,
            new_path: ({ event }) => event.folder_path,
            error: () => null
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
        CONFIRM: 'renaming',
        CANCEL: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            new_path: () => null,
            contains_open_note: () => false,
            error: () => null
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
          folder_path: context.folder_path!,
          new_path: context.new_path!
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            new_path: () => null,
            contains_open_note: () => false
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
        RETRY: 'renaming',
        CANCEL: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            new_path: () => null,
            contains_open_note: () => false,
            error: () => null
          })
        }
      }
    }
  }
})
