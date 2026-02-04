import { setup, assign } from 'xstate'
import { parse_search_query } from '$lib/utils/search_query_parser'
import { search_palette } from '$lib/operations/search_palette'
import type { CommandDefinition } from '$lib/utils/search_commands'
import type { SettingDefinition } from '$lib/types/settings_registry'

type FlowContext = {
  query: string
  selected_index: number
  commands: CommandDefinition[]
  settings: SettingDefinition[]
}

export type CommandPaletteFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'SET_QUERY'; query: string }
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
  context: () => {
    const initial = search_palette({ query: parse_search_query('') })
    return {
      query: '',
      selected_index: 0,
      commands: initial.commands,
      settings: initial.settings
    }
  },
  states: {
    closed: {
      on: {
        OPEN: {
          target: 'open',
          actions: assign(() => {
            const result = search_palette({ query: parse_search_query('') })
            return {
              query: '',
              selected_index: 0,
              commands: result.commands,
              settings: result.settings
            }
          })
        },
        TOGGLE: {
          target: 'open',
          actions: assign(() => {
            const result = search_palette({ query: parse_search_query('') })
            return {
              query: '',
              selected_index: 0,
              commands: result.commands,
              settings: result.settings
            }
          })
        }
      }
    },
    open: {
      on: {
        CLOSE: 'closed',
        TOGGLE: 'closed',
        SET_QUERY: {
          actions: assign(({ event }) => {
            const result = search_palette({ query: parse_search_query(event.query) })
            return {
              query: event.query,
              selected_index: 0,
              commands: result.commands,
              settings: result.settings
            }
          })
        },
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
