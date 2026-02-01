import { setup, assign, fromPromise } from 'xstate'
import { delete_folder } from '$lib/operations/delete_folder'
import { get_folder_stats } from '$lib/operations/get_folder_stats'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type DeleteFolderPorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  folder_path: string | null
  vault_id: VaultId | null
  contains_open_note: boolean
  affected_note_count: number
  affected_folder_count: number
  error: string | null
  ports: DeleteFolderPorts
  dispatch: AppStateDispatch
}

export type DeleteFolderFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_DELETE'; vault_id: VaultId; folder_path: string; contains_open_note: boolean }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type DeleteFolderFlowEvents = FlowEvents

type FlowInput = {
  ports: DeleteFolderPorts
  dispatch: AppStateDispatch
}

export const delete_folder_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    fetch_stats: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: DeleteFolderPorts
          vault_id: VaultId
          folder_path: string
        }
      }) => {
        const { ports, vault_id, folder_path } = input
        return await get_folder_stats(ports, { vault_id, folder_path })
      }
    ),
    perform_delete: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: DeleteFolderPorts
          dispatch: AppStateDispatch
          vault_id: VaultId
          folder_path: string
          contains_open_note: boolean
        }
      }) => {
        const { ports, dispatch, vault_id, folder_path, contains_open_note } = input

        await delete_folder(ports, { vault_id, folder_path })

        dispatch({ type: 'REMOVE_FOLDER_FROM_STATE', folder_path })

        if (contains_open_note) dispatch({ type: 'CLEAR_OPEN_NOTE' })
        dispatch({ type: 'COMMAND_ENSURE_OPEN_NOTE' })

        void ports.index.build_index(vault_id)
      }
    )
  }
}).createMachine({
  id: 'delete_folder_flow',
  initial: 'idle',
  context: ({ input }) => ({
    folder_path: null,
    vault_id: null,
    contains_open_note: false,
    affected_note_count: 0,
    affected_folder_count: 0,
    error: null,
    ports: input.ports,
    dispatch: input.dispatch
  }),
  states: {
    idle: {
      on: {
        REQUEST_DELETE: {
          target: 'fetching_stats',
          actions: assign({
            folder_path: ({ event }) => event.folder_path,
            vault_id: ({ event }) => event.vault_id,
            contains_open_note: ({ event }) => event.contains_open_note,
            affected_note_count: () => 0,
            affected_folder_count: () => 0,
            error: () => null
          })
        }
      }
    },
    fetching_stats: {
      invoke: {
        src: 'fetch_stats',
        input: ({ context }) => ({
          ports: context.ports,
          vault_id: context.vault_id!,
          folder_path: context.folder_path!
        }),
        onDone: {
          target: 'confirming',
          actions: assign({
            affected_note_count: ({ event }) => event.output.note_count,
            affected_folder_count: ({ event }) => event.output.folder_count
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
    confirming: {
      on: {
        CONFIRM: 'deleting',
        CANCEL: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            contains_open_note: () => false,
            affected_note_count: () => 0,
            affected_folder_count: () => 0
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
          folder_path: context.folder_path!,
          contains_open_note: context.contains_open_note
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            contains_open_note: () => false,
            affected_note_count: () => 0,
            affected_folder_count: () => 0
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
            folder_path: () => null,
            vault_id: () => null,
            contains_open_note: () => false,
            affected_note_count: () => 0,
            affected_folder_count: () => 0,
            error: () => null
          })
        }
      }
    }
  }
})
