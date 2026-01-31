import { setup, assign, fromPromise } from 'xstate'
import { create_folder_and_refresh } from '$lib/operations/create_folder'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type CreateFolderPorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  parent_path: string
  folder_name: string
  vault_id: VaultId | null
  error: string | null
  ports: CreateFolderPorts
  dispatch: AppStateDispatch
}

export type CreateFolderFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_CREATE'; vault_id: VaultId; parent_path: string }
  | { type: 'UPDATE_FOLDER_NAME'; name: string }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type CreateFolderFlowEvents = FlowEvents

type FlowInput = {
  ports: CreateFolderPorts
  dispatch: AppStateDispatch
}

export const create_folder_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_create: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: CreateFolderPorts
          dispatch: AppStateDispatch
          vault_id: VaultId
          parent_path: string
          folder_name: string
        }
      }) => {
        const { ports, dispatch, vault_id, parent_path, folder_name } = input

        const result = await create_folder_and_refresh(
          { notes: ports.notes },
          { vault_id, parent_path, folder_name }
        )

        dispatch({ type: 'UPDATE_FOLDER_LIST', folder_paths: result.folder_paths })

        void ports.index.build_index(vault_id)
      }
    )
  }
}).createMachine({
  id: 'create_folder_flow',
  initial: 'idle',
  context: ({ input }) => ({
    parent_path: '',
    folder_name: '',
    vault_id: null,
    error: null,
    ports: input.ports,
    dispatch: input.dispatch
  }),
  states: {
    idle: {
      entry: assign({
        parent_path: () => '',
        folder_name: '',
        vault_id: () => null,
        error: () => null
      }),
      on: {
        REQUEST_CREATE: {
          target: 'dialog_open',
          actions: assign({
            vault_id: ({ event }) => event.vault_id,
            parent_path: ({ event }) => event.parent_path,
            folder_name: () => '',
            error: () => null
          })
        }
      }
    },
    dialog_open: {
      on: {
        UPDATE_FOLDER_NAME: {
          actions: assign({
            folder_name: ({ event }) => event.name
          })
        },
        CONFIRM: 'creating',
        CANCEL: {
          target: 'idle',
          actions: assign({
            parent_path: () => '',
            folder_name: '',
            vault_id: () => null,
            error: () => null
          })
        }
      }
    },
    creating: {
      invoke: {
        src: 'perform_create',
        input: ({ context }) => ({
          ports: context.ports,
          dispatch: context.dispatch,
          vault_id: context.vault_id!,
          parent_path: context.parent_path,
          folder_name: context.folder_name
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            parent_path: () => '',
            folder_name: '',
            vault_id: () => null
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
        RETRY: {
          target: 'creating',
          actions: assign({
            error: () => null
          })
        },
        CANCEL: {
          target: 'idle',
          actions: assign({
            parent_path: () => '',
            folder_name: '',
            vault_id: () => null,
            error: () => null
          })
        }
      }
    }
  }
})
