import { setup, assign, fromPromise } from 'xstate'
import type { SearchPort } from '$lib/ports/search_port'
import type { VaultId, NoteId } from '$lib/types/ids'
import type { NoteSearchHit } from '$lib/types/search'

type FileSearchPorts = {
  search: SearchPort
}

type FlowContext = {
  query: string
  results: NoteSearchHit[]
  selected_index: number
  is_searching: boolean
  recent_notes: NoteId[]
  ports: FileSearchPorts
  get_vault_id: () => VaultId | null
}

export type FileSearchFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_SELECTED_INDEX'; index: number }
  | { type: 'ARROW_UP' }
  | { type: 'ARROW_DOWN' }
  | { type: 'CONFIRM' }
  | { type: 'ADD_RECENT'; note_id: NoteId }

export type FileSearchFlowEvents = FlowEvents

type FlowInput = {
  ports: FileSearchPorts
  get_vault_id: () => VaultId | null
  initial_recent_notes?: NoteId[]
}

export const file_search_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_search: fromPromise(
      async ({
        input
      }: {
        input: { ports: FileSearchPorts; vault_id: VaultId; query: string }
      }): Promise<NoteSearchHit[]> => {
        return input.ports.search.search_notes(input.vault_id, input.query, 20)
      }
    )
  },
  actions: {
    reset_state: assign({
      query: () => '',
      results: () => [],
      selected_index: () => 0,
      is_searching: () => false
    }),
    move_selection_up: assign({
      selected_index: ({ context }) => {
        const count = context.query ? context.results.length : context.recent_notes.length
        if (count === 0) return 0
        return (context.selected_index - 1 + count) % count
      }
    }),
    move_selection_down: assign({
      selected_index: ({ context }) => {
        const count = context.query ? context.results.length : context.recent_notes.length
        if (count === 0) return 0
        return (context.selected_index + 1) % count
      }
    }),
    add_to_recent: assign({
      recent_notes: ({ context, event }) => {
        if (event.type !== 'ADD_RECENT') return context.recent_notes
        const filtered = context.recent_notes.filter((id) => id !== event.note_id)
        return [event.note_id, ...filtered].slice(0, 10)
      }
    })
  },
  guards: {
    has_query: ({ context }) => context.query.trim().length > 0,
    has_vault: ({ context }) => context.get_vault_id() !== null
  }
}).createMachine({
  id: 'file_search_flow',
  initial: 'closed',
  context: ({ input }) => ({
    query: '',
    results: [],
    selected_index: 0,
    is_searching: false,
    recent_notes: input.initial_recent_notes ?? [],
    ports: input.ports,
    get_vault_id: input.get_vault_id
  }),
  states: {
    closed: {
      on: {
        OPEN: { target: 'open', actions: 'reset_state' },
        TOGGLE: { target: 'open', actions: 'reset_state' },
        ADD_RECENT: { actions: 'add_to_recent' }
      }
    },
    open: {
      initial: 'idle',
      on: {
        CLOSE: 'closed',
        TOGGLE: 'closed',
        ARROW_UP: { actions: 'move_selection_up' },
        ARROW_DOWN: { actions: 'move_selection_down' },
        SET_SELECTED_INDEX: {
          actions: assign({ selected_index: ({ event }) => event.index })
        },
        ADD_RECENT: { actions: 'add_to_recent' }
      },
      states: {
        idle: {
          on: {
            SET_QUERY: [
              {
                guard: ({ event }) => event.query.trim().length > 0,
                target: 'searching',
                actions: assign({
                  query: ({ event }) => event.query,
                  selected_index: () => 0,
                  is_searching: () => true
                })
              },
              {
                actions: assign({
                  query: ({ event }) => event.query,
                  results: () => [],
                  selected_index: () => 0
                })
              }
            ],
            CONFIRM: { target: '#file_search_flow.closed' }
          }
        },
        searching: {
          invoke: {
            src: 'perform_search',
            input: ({ context }) => ({
              ports: context.ports,
              vault_id: context.get_vault_id()!,
              query: context.query
            }),
            onDone: {
              target: 'idle',
              actions: assign({
                results: ({ event }) => event.output,
                is_searching: () => false
              })
            },
            onError: {
              target: 'idle',
              actions: assign({
                results: () => [],
                is_searching: () => false
              })
            }
          },
          on: {
            SET_QUERY: [
              {
                guard: ({ event }) => event.query.trim().length > 0,
                target: 'searching',
                reenter: true,
                actions: assign({
                  query: ({ event }) => event.query,
                  selected_index: () => 0,
                  is_searching: () => true
                })
              },
              {
                target: 'idle',
                actions: assign({
                  query: ({ event }) => event.query,
                  results: () => [],
                  selected_index: () => 0,
                  is_searching: () => false
                })
              }
            ],
            CONFIRM: { target: '#file_search_flow.closed' }
          }
        }
      }
    }
  }
})
