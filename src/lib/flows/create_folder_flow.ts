import { setup, assign, fromPromise } from 'xstate'
import { create_folder } from '$lib/operations/create_folder'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'

type CreateFolderPorts = {
  notes: NotesPort
}

type FlowContext = {
  parent_path: string
  folder_name: string
  vault_id: VaultId | null
  error: string | null
  ports: CreateFolderPorts
  stores: AppStores
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
  stores: AppStores
}

const reset_form = {
  parent_path: '',
  folder_name: '',
  vault_id: null as VaultId | null,
  error: null as string | null
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
          stores: AppStores
          vault_id: VaultId
          parent_path: string
          folder_name: string
        }
      }) => {
        const { ports, stores, vault_id, parent_path, folder_name } = input

        const result = await create_folder(
          { notes: ports.notes },
          { vault_id, parent_path, folder_name }
        )

        stores.notes.actions.add_folder_path(result.new_folder_path)
      }
    )
  },
  actions: {
    reset_state: assign(() => reset_form)
  }
}).createMachine({
  id: 'create_folder_flow',
  initial: 'idle',
  context: ({ input }) => ({
    ...reset_form,
    ports: input.ports,
    stores: input.stores
  }),
  states: {
    idle: {
      entry: 'reset_state',
      on: {
        REQUEST_CREATE: {
          target: 'dialog_open',
          actions: assign({
            vault_id: ({ event }) => event.vault_id,
            parent_path: ({ event }) => event.parent_path
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
        CANCEL: 'idle'
      }
    },
    creating: {
      invoke: {
        src: 'perform_create',
        input: ({ context }) => ({
          ports: context.ports,
          stores: context.stores,
          vault_id: context.vault_id!,
          parent_path: context.parent_path,
          folder_name: context.folder_name
        }),
        onDone: 'idle',
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
          actions: assign({ error: null })
        },
        CANCEL: 'idle'
      }
    }
  }
})
