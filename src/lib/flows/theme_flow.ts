import { setup } from 'xstate'
import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/types/theme'
import type { AppEvent } from '$lib/events/app_event'
import { set_theme_use_case } from '$lib/use_cases/set_theme_use_case'

type ThemeFlowPorts = {
  theme: ThemePort
}

type FlowContext = {
  ports: ThemeFlowPorts
  dispatch_many: (events: AppEvent[]) => void
}

export type ThemeFlowContext = FlowContext

type FlowEvents = { type: 'SET_THEME'; theme: ThemeMode }

export type ThemeFlowEvents = FlowEvents

type FlowInput = {
  ports: ThemeFlowPorts
  dispatch_many: (events: AppEvent[]) => void
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
    dispatch_many: input.dispatch_many
  }),
  states: {
    idle: {
      on: {
        SET_THEME: {
          actions: ({ context, event }) => {
            try {
              const events = set_theme_use_case({ theme: context.ports.theme }, { theme: event.theme })
              context.dispatch_many(events)
            } catch (error) {
              context.dispatch_many([{ type: 'ui_theme_set_failed', error: String(error) }])
            }
          }
        }
      }
    }
  }
})
