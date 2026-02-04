import { setup, assign, fromPromise } from 'xstate'
import { init_theme } from '$lib/operations/init_theme'
import { load_editor_settings } from '$lib/operations/load_editor_settings'
import { apply_editor_styles } from '$lib/operations/apply_editor_styles'
import type { ThemePort } from '$lib/ports/theme_port'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { AppStores } from '$lib/stores/create_app_stores'

type PreferencesInitializationPorts = {
  theme: ThemePort
  settings: SettingsPort
}

type FlowContext = {
  error: string | null
  ports: PreferencesInitializationPorts
  stores: AppStores
}

export type PreferencesInitializationFlowContext = FlowContext

type FlowEvents = { type: 'INITIALIZE' } | { type: 'RETRY' } | { type: 'CANCEL' }

export type PreferencesInitializationFlowEvents = FlowEvents

type FlowInput = {
  ports: PreferencesInitializationPorts
  stores: AppStores
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
        }
      }) => {
        const { ports, stores } = input

        const theme_mode = init_theme(ports.theme)
        stores.ui.actions.set_theme(theme_mode)

        const editor_settings = await load_editor_settings(ports.settings)
        stores.ui.actions.set_editor_settings(editor_settings)
        apply_editor_styles(editor_settings)
      }
    )
  }
}).createMachine({
  id: 'preferences_initialization_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    ports: input.ports,
    stores: input.stores
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
          stores: context.stores
        }),
        onDone: 'idle',
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
