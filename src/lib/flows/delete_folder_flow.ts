import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import type { AppEvent } from '$lib/events/app_event'
import { get_folder_stats_use_case } from '$lib/use_cases/get_folder_stats_use_case'
import { delete_folder_use_case } from '$lib/use_cases/delete_folder_use_case'

type DeleteFolderPorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type FlowContext = {
  folder_path: string | null
  vault_id: VaultId | null
  contains_open_note: boolean
  affected_note_count: number
  affected_folder_count: number
  error: string | null
  ports: DeleteFolderPorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
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
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
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
        return await get_folder_stats_use_case({ notes: ports.notes }, { vault_id, folder_path })
      }
    ),
    perform_delete: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: DeleteFolderPorts
          stores: AppStores
          vault_id: VaultId
          folder_path: string
          contains_open_note: boolean
          dispatch_many: (events: AppEvent[]) => void
          now_ms: () => number
        }
      }): Promise<AppEvent[]> => {
        return await delete_folder_use_case(
          { notes: input.ports.notes, index: input.ports.index },
          {
            vault_id: input.vault_id,
            folder_path: input.folder_path,
            contains_open_note: input.contains_open_note,
            current_vault: input.stores.vault.get_snapshot().vault,
            current_notes: input.stores.notes.get_snapshot().notes,
            current_open_note: input.stores.editor.get_snapshot().open_note,
            now_ms: input.now_ms()
          }
        )
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
    stores: input.stores,
    dispatch_many: input.dispatch_many,
    now_ms: input.now_ms
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
        input: ({ context }) => {
          if (!context.vault_id) throw new Error('vault_id required in fetching_stats state')
          if (!context.folder_path) throw new Error('folder_path required in fetching_stats state')
          return {
            ports: context.ports,
            vault_id: context.vault_id,
            folder_path: context.folder_path
          }
        },
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
        input: ({ context }) => {
          if (!context.vault_id) throw new Error('vault_id required in deleting state')
          if (!context.folder_path) throw new Error('folder_path required in deleting state')
          return {
            ports: context.ports,
            stores: context.stores,
            vault_id: context.vault_id,
            folder_path: context.folder_path,
            contains_open_note: context.contains_open_note,
            dispatch_many: context.dispatch_many,
            now_ms: context.now_ms
          }
        },
        onDone: {
          target: 'idle',
          actions: [
            assign({
              folder_path: () => null,
              vault_id: () => null,
              contains_open_note: () => false,
              affected_note_count: () => 0,
              affected_folder_count: () => 0
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
