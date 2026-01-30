import { setup, assign, fromPromise } from 'xstate'
import { change_vault } from '$lib/operations/change_vault'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultPath } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/state/app_state_machine'
import type { FlowSnapshot } from '$lib/flows/flow_handle'
import type { AppStateContext } from '$lib/state/app_state_machine'

type OpenAppPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type GetAppStateSnapshot = () => FlowSnapshot<AppStateContext>

type StartupConfig = {
  reset_app_state: boolean
  bootstrap_default_vault_path: VaultPath | null
}

export type OpenAppStartupConfig = StartupConfig

type FlowContext = {
  error: string | null
  ports: OpenAppPorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
  startup_config: StartupConfig
}

export type OpenAppFlowContext = FlowContext

type FlowEvents =
  | { type: 'START'; config: StartupConfig }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export type OpenAppFlowEvents = FlowEvents

type FlowInput = {
  ports: OpenAppPorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
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
          get_app_state_snapshot: GetAppStateSnapshot
          config: StartupConfig
        }
      }) => {
        const { ports, dispatch, get_app_state_snapshot, config } = input

        if (config.reset_app_state) dispatch({ type: 'RESET_APP' })

        const recent_vaults = await ports.vault.list_vaults()
        dispatch({ type: 'SET_RECENT_VAULTS', recent_vaults })

        const is_no_vault = get_app_state_snapshot().matches('no_vault')

        if (is_no_vault && config.bootstrap_default_vault_path) {
          const result = await change_vault(
            { vault: ports.vault, notes: ports.notes },
            { vault_path: config.bootstrap_default_vault_path }
          )
          void ports.index.build_index(result.vault.id)
          dispatch({
            type: 'SET_ACTIVE_VAULT',
            vault: result.vault,
            notes: result.notes,
            folder_paths: result.folder_paths
          })
          const updated_recent_vaults = await ports.vault.list_vaults()
          dispatch({ type: 'SET_RECENT_VAULTS', recent_vaults: updated_recent_vaults })
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
    get_app_state_snapshot: input.get_app_state_snapshot,
    startup_config: {
      reset_app_state: false,
      bootstrap_default_vault_path: null
    }
  }),
  states: {
    idle: {
      entry: assign({
        error: () => null,
        startup_config: () => ({ reset_app_state: false, bootstrap_default_vault_path: null })
      }),
      on: {
        START: {
          target: 'starting',
          actions: assign({
            error: () => null,
            startup_config: ({ event }) => event.config
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
          get_app_state_snapshot: context.get_app_state_snapshot,
          config: context.startup_config
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
