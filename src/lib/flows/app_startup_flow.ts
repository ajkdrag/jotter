import { setup, assign, fromPromise } from 'xstate'
import { init_theme } from '$lib/operations/init_theme'
import { load_editor_settings } from '$lib/operations/load_editor_settings'
import { apply_editor_styles } from '$lib/operations/apply_editor_styles'
import type { ThemePort } from '$lib/ports/theme_port'
import type { SettingsPort } from '$lib/ports/settings_port'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type AppStartupPorts = {
  theme: ThemePort
  settings: SettingsPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type FlowContext = {
  error: string | null
  ports: AppStartupPorts
  dispatch: AppStateDispatch
}

export type AppStartupFlowContext = FlowContext

type FlowEvents = { type: 'INITIALIZE' } | { type: 'RETRY' } | { type: 'CANCEL' }

export type AppStartupFlowEvents = FlowEvents

type FlowInput = {
  ports: AppStartupPorts
  dispatch: AppStateDispatch
}

export const app_startup_flow_machine = setup({
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
          ports: AppStartupPorts
          dispatch: AppStateDispatch
        }
      }) => {
        const { ports, dispatch } = input

        const theme_mode = init_theme(ports.theme)
        dispatch({ type: 'SET_THEME', theme: theme_mode })

        const editor_settings = await load_editor_settings(ports.settings)
        apply_editor_styles(editor_settings)
      }
    )
  }
}).createMachine({
  id: 'app_startup_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    ports: input.ports,
    dispatch: input.dispatch
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
          dispatch: context.dispatch
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
