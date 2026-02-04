import { setup, assign, fromPromise } from 'xstate'
import { rename_folder } from '$lib/operations/rename_folder'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'

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
        }
      }) => {
        const { ports, stores, vault_id, folder_path, new_path } = input

        await rename_folder(ports, { vault_id, from_path: folder_path, to_path: new_path })

        stores.notes.actions.rename_folder(folder_path, new_path)

        const old_prefix = folder_path + '/'
        const new_prefix = new_path + '/'
        const open_note = stores.editor.get_snapshot().open_note
        if (open_note?.meta.path.startsWith(old_prefix)) {
          stores.editor.actions.update_path_prefix(old_prefix, new_prefix)
        }

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
    error: null,
    ports: input.ports,
    stores: input.stores
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
            new_path: context.new_path
          }
        },
        onDone: {
          target: 'idle',
          actions: assign({
            folder_path: () => null,
            vault_id: () => null,
            new_path: () => null
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
            error: () => null
          })
        }
      }
    }
  }
})
