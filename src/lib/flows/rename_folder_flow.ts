import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import type { AppEvent } from '$lib/events/app_event'
import { rename_folder_use_case } from '$lib/use_cases/rename_folder_use_case'

type RenameFolderPorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type FlowContext = {
  folder_path: string | null
  vault_id: VaultId | null
  new_path: string | null
  error: string | null
  ports: RenameFolderPorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
}

export type RenameFolderFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_RENAME'; vault_id: VaultId; folder_path: string }
  | { type: 'UPDATE_NEW_PATH'; path: string }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type RenameFolderFlowEvents = FlowEvents

type FlowInput = {
  ports: RenameFolderPorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
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
          stores: AppStores
          vault_id: VaultId
          folder_path: string
          new_path: string
          dispatch_many: (events: AppEvent[]) => void
        }
      }): Promise<AppEvent[]> => {
        return await rename_folder_use_case(
          { notes: input.ports.notes, index: input.ports.index },
          {
            vault_id: input.vault_id,
            folder_path: input.folder_path,
            new_path: input.new_path,
            current_notes: input.stores.notes.get_snapshot().notes,
            current_open_note: input.stores.editor.get_snapshot().open_note
          }
        )
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
    error: null,
    ports: input.ports,
    stores: input.stores,
    dispatch_many: input.dispatch_many
  }),
  states: {
    idle: {
      on: {
        REQUEST_RENAME: {
          target: 'confirming',
          actions: assign({
            folder_path: ({ event }) => event.folder_path,
            vault_id: ({ event }) => event.vault_id,
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
            error: () => null
          })
        }
      }
    },
    renaming: {
      invoke: {
        src: 'perform_rename',
        input: ({ context }) => {
          if (!context.vault_id) throw new Error('vault_id required in renaming state')
          if (!context.folder_path) throw new Error('folder_path required in renaming state')
          if (!context.new_path) throw new Error('new_path required in renaming state')
          return {
            ports: context.ports,
            stores: context.stores,
            vault_id: context.vault_id,
            folder_path: context.folder_path,
            new_path: context.new_path,
            dispatch_many: context.dispatch_many
          }
        },
        onDone: {
          target: 'idle',
          actions: [
            assign({
              folder_path: () => null,
              vault_id: () => null,
              new_path: () => null
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
        RETRY: 'renaming',
        CANCEL: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            new_path: () => null,
            error: () => null
          })
        }
      }
    }
  }
})
