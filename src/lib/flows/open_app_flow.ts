import { setup, assign, fromPromise } from 'xstate'
import { change_vault } from '$lib/operations/change_vault'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultPath } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/flows/app_state_machine'

type OpenAppPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  error: string | null
  ports: OpenAppPorts
  dispatch: AppStateDispatch
  bootstrap_default_vault_path: VaultPath | null
}

type FlowEvents =
  | { type: 'START'; bootstrap_default_vault_path?: VaultPath | null }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

type FlowInput = {
  ports: OpenAppPorts
  dispatch: AppStateDispatch
}

export const open_app_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    startup: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: OpenAppPorts
          dispatch: AppStateDispatch
          bootstrap_default_vault_path: VaultPath | null
        }
      }) => {
        const { ports, dispatch, bootstrap_default_vault_path } = input

        const recent_vaults = await ports.vault.list_vaults()
        dispatch({ type: 'RECENT_VAULTS_SET', recent_vaults })

        if (bootstrap_default_vault_path) {
          const result = await change_vault({ vault: ports.vault, notes: ports.notes }, { vault_path: bootstrap_default_vault_path })
          void ports.index.build_index(result.vault.id)
          dispatch({ type: 'VAULT_SET', vault: result.vault, notes: result.notes })
          const updated_recent_vaults = await ports.vault.list_vaults()
          dispatch({ type: 'RECENT_VAULTS_SET', recent_vaults: updated_recent_vaults })
        }
      }
    )
  }
}).createMachine({
  id: 'open_app_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    ports: input.ports,
    dispatch: input.dispatch,
    bootstrap_default_vault_path: null
  }),
  states: {
    idle: {
      entry: assign({ error: () => null, bootstrap_default_vault_path: () => null }),
      on: {
        START: {
          target: 'starting',
          actions: assign({
            error: () => null,
            bootstrap_default_vault_path: ({ event }) => (event.bootstrap_default_vault_path ?? null)
          })
        }
      }
    },
    starting: {
      invoke: {
        src: 'startup',
        input: ({ context }) => ({
          ports: context.ports,
          dispatch: context.dispatch,
          bootstrap_default_vault_path: context.bootstrap_default_vault_path
        }),
        onDone: 'idle',
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    error: {
      on: {
        RETRY: {
          target: 'starting',
          actions: assign({ error: () => null })
        },
        CANCEL: {
          target: 'idle',
          actions: assign({ error: () => null })
        }
      }
    }
  }
})
