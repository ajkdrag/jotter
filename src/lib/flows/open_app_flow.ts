import { setup, assign, fromPromise } from 'xstate'
import { startup_app } from '$lib/operations/startup_app'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultPath } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'

type OpenAppPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
}

type StartupConfig = {
  reset_app_state: boolean
  bootstrap_default_vault_path: VaultPath | null
}

export type OpenAppStartupConfig = StartupConfig

type FlowContext = {
  error: string | null
  ports: OpenAppPorts
  stores: AppStores
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
  stores: AppStores
}

function reset_all_stores(stores: AppStores): void {
  stores.vault.actions.clear_vault()
  stores.vault.actions.set_recent_vaults([])
  stores.notes.actions.set_notes([])
  stores.notes.actions.set_folder_paths([])
  stores.editor.actions.clear_open_note()
  stores.ui.actions.set_theme('system')
  stores.ui.actions.set_sidebar_open(true)
  stores.ui.actions.set_selected_folder_path('')
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
          stores: AppStores
          config: StartupConfig
        }
      }) => {
        const { ports, stores, config } = input

        if (config.reset_app_state) {
          reset_all_stores(stores)
        }

        const has_vault = stores.vault.get_snapshot().vault !== null

        const result = await startup_app(ports, {
          bootstrap_vault_path: config.bootstrap_default_vault_path,
          current_app_state: has_vault ? 'vault_open' : 'no_vault'
        })

        stores.vault.actions.set_recent_vaults(result.recent_vaults)

        if (result.bootstrapped_vault) {
          stores.vault.actions.set_vault(result.bootstrapped_vault.vault)
          stores.notes.actions.set_notes(result.bootstrapped_vault.notes)
          stores.notes.actions.set_folder_paths(result.bootstrapped_vault.folder_paths)
          stores.editor.actions.ensure_open_note(
            result.bootstrapped_vault.vault,
            result.bootstrapped_vault.notes,
            stores.now_ms()
          )
          const updated_recent_vaults = await ports.vault.list_vaults()
          stores.vault.actions.set_recent_vaults(updated_recent_vaults)
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
    stores: input.stores,
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
          stores: context.stores,
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
