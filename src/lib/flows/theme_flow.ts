import { setup } from 'xstate'
import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/types/theme'
import type { AppStores } from '$lib/stores/create_app_stores'

type ThemeFlowPorts = {
  theme: ThemePort
}

type FlowContext = {
  ports: ThemeFlowPorts
  stores: AppStores
}

export type ThemeFlowContext = FlowContext

type FlowEvents = { type: 'SET_THEME'; theme: ThemeMode }

export type ThemeFlowEvents = FlowEvents

type FlowInput = {
  ports: ThemeFlowPorts
  stores: AppStores
}

export const theme_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  }
}).createMachine({
  id: 'theme_flow',
  initial: 'idle',
  context: ({ input }) => ({
    ports: input.ports,
    stores: input.stores
  }),
  states: {
    idle: {
      on: {
        SET_THEME: {
          actions: ({ context, event }) => {
            try {
              context.ports.theme.set_theme(event.theme)
              context.stores.ui.actions.set_theme(event.theme)
            } catch (error) {
              console.error('Failed to set theme:', error)
            }
          }
        }
      }
    }
  }
})
