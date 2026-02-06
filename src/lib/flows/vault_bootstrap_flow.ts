import { setup, assign, fromPromise } from 'xstate'
import { startup_app_use_case } from '$lib/use_cases/startup_app_use_case'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultPath } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'
import type { AppEvent } from '$lib/events/app_event'

type VaultBootstrapPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
}

type BootstrapConfig = {
  reset_app_state: boolean
  bootstrap_default_vault_path: VaultPath | null
}

export type VaultBootstrapConfig = BootstrapConfig

type FlowContext = {
  error: string | null
  ports: VaultBootstrapPorts
  stores: AppStores
  startup_config: BootstrapConfig
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

export type VaultBootstrapFlowContext = FlowContext

type FlowEvents =
  | { type: 'START'; config: BootstrapConfig }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export type VaultBootstrapFlowEvents = FlowEvents

type FlowInput = {
  ports: VaultBootstrapPorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

function reset_all_events(): AppEvent[] {
  return [
    { type: 'vault_cleared' },
    { type: 'recent_vaults_set', vaults: [] },
    { type: 'notes_set', notes: [] },
    { type: 'folders_set', folder_paths: [] },
    { type: 'open_note_cleared' },
    { type: 'ui_theme_set', theme: 'system' },
    { type: 'ui_sidebar_set', open: true },
    { type: 'ui_selected_folder_set', path: '' },
    { type: 'ui_editor_settings_set', settings: DEFAULT_EDITOR_SETTINGS }
  ]
}

export const vault_bootstrap_flow_machine = setup({
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
          ports: VaultBootstrapPorts
          stores: AppStores
          config: BootstrapConfig
          dispatch_many: (events: AppEvent[]) => void
          now_ms: () => number
        }
      }): Promise<AppEvent[]> => {
        const { ports, stores, config, now_ms } = input

        const events: AppEvent[] = []
        if (config.reset_app_state) {
          events.push(...reset_all_events())
        }

        const has_vault = stores.vault.get_snapshot().vault !== null

        const startup_events = await startup_app_use_case(ports, {
          bootstrap_vault_path: config.bootstrap_default_vault_path,
          current_app_state: has_vault ? 'vault_open' : 'no_vault'
        }, now_ms())

        events.push(...startup_events)
        return events
      }
    )
  }
}).createMachine({
  id: 'vault_bootstrap_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    ports: input.ports,
    stores: input.stores,
    startup_config: {
      reset_app_state: false,
      bootstrap_default_vault_path: null
    },
    dispatch_many: input.dispatch_many,
    now_ms: input.now_ms
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
          config: context.startup_config,
          dispatch_many: context.dispatch_many,
          now_ms: context.now_ms
        }),
        onDone: {
          target: 'idle',
          actions: ({ context, event }) => {
            context.dispatch_many(event.output)
          }
        },
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
