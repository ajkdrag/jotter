import { setup, assign, fromPromise } from 'xstate'
import { init_theme_use_case } from '$lib/use_cases/init_theme_use_case'
import { load_editor_settings_use_case } from '$lib/use_cases/load_editor_settings_use_case'
import type { ThemePort } from '$lib/ports/theme_port'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { VaultSettingsPort } from '$lib/ports/vault_settings_port'
import type { AppStores } from '$lib/stores/create_app_stores'
import type { AppEvent } from '$lib/events/app_event'
import { DEFAULT_EDITOR_SETTINGS } from '$lib/types/editor_settings'

type PreferencesInitializationPorts = {
  theme: ThemePort
  settings: SettingsPort
  vault_settings: VaultSettingsPort
}

type FlowContext = {
  error: string | null
  ports: PreferencesInitializationPorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
}

export type PreferencesInitializationFlowContext = FlowContext

type FlowEvents = { type: 'INITIALIZE' } | { type: 'RETRY' } | { type: 'CANCEL' }

export type PreferencesInitializationFlowEvents = FlowEvents

type FlowInput = {
  ports: PreferencesInitializationPorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
}

export const preferences_initialization_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_startup: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: PreferencesInitializationPorts
          stores: AppStores
          dispatch_many: (events: AppEvent[]) => void
        }
      }): Promise<AppEvent[]> => {
        const { ports, stores } = input

        const events: AppEvent[] = []
        events.push(...init_theme_use_case({ theme: ports.theme }))

        const vault_id = stores.vault.get_snapshot().vault?.id
        if (vault_id) {
          const settings_events = await load_editor_settings_use_case(
            { vault_settings: ports.vault_settings, settings: ports.settings },
            { vault_id }
          )
          events.push(...settings_events)
        } else {
          events.push({ type: 'ui_editor_settings_set', settings: DEFAULT_EDITOR_SETTINGS })
        }

        return events
      }
    )
  }
}).createMachine({
  id: 'preferences_initialization_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    ports: input.ports,
    stores: input.stores,
    dispatch_many: input.dispatch_many
  }),
  states: {
    idle: {
      entry: assign({
        error: () => null
      }),
      on: {
        INITIALIZE: {
          target: 'initializing',
          actions: assign({
            error: () => null
          })
        }
      }
    },
    initializing: {
      invoke: {
        src: 'perform_startup',
        input: ({ context }) => ({
          ports: context.ports,
          stores: context.stores,
          dispatch_many: context.dispatch_many
        }),
        onDone: {
          target: 'idle',
          actions: ({ context, event }) => {
            context.dispatch_many(event.output)
          }
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event}) => String(event.error)
          })
        }
      }
    },
    error: {
      on: {
        RETRY: {
          target: 'initializing',
          actions: assign({
            error: () => null
          })
        },
        CANCEL: {
          target: 'idle',
          actions: assign({
            error: () => null
          })
        }
      }
    }
  }
})
