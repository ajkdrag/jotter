import { setup, assign, fromPromise } from 'xstate'
import { delete_folder } from '$lib/operations/delete_folder'
import { get_folder_stats } from '$lib/operations/get_folder_stats'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'

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
          stores: AppStores
          vault_id: VaultId
          folder_path: string
          contains_open_note: boolean
        }
      }) => {
        const { ports, stores, vault_id, folder_path, contains_open_note } = input

        await delete_folder(ports, { vault_id, folder_path })

        stores.notes.actions.remove_folder(folder_path)

        if (contains_open_note) {
          stores.editor.actions.clear_open_note()
        }

        const vault = stores.vault.get_snapshot().vault
        const notes = stores.notes.get_snapshot().notes
        stores.editor.actions.ensure_open_note(vault, notes, stores.now_ms())

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
    stores: input.stores
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
            contains_open_note: context.contains_open_note
          }
        },
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
