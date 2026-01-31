import { setup, assign } from 'xstate'

type FlowContext = {
  selected_index: number
}

export type CommandPaletteFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'SET_SELECTED_INDEX'; index: number }
  | { type: 'EXECUTE_COMMAND'; command: string }

export type CommandPaletteFlowEvents = FlowEvents

export const command_palette_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents
  }
}).createMachine({
  id: 'command_palette_flow',
  initial: 'closed',
  context: {
    selected_index: 0
  },
  states: {
    closed: {
      on: {
        OPEN: {
          target: 'open',
          actions: assign({ selected_index: 0 })
        },
        TOGGLE: {
          target: 'open',
          actions: assign({ selected_index: 0 })
        }
      }
    },
    open: {
      on: {
        CLOSE: 'closed',
        TOGGLE: 'closed',
        SET_SELECTED_INDEX: {
          actions: assign({
            selected_index: ({ event }) => event.index
          })
        },
        EXECUTE_COMMAND: 'closed'
      }
    }
  }
})
