import { setup, assign, fromPromise } from 'xstate'
import { open_note } from '$lib/operations/open_note'
import { to_open_note_state } from '$lib/types/editor'
import { as_note_path } from '$lib/types/ids'
import type { NotesPort } from '$lib/ports/notes_port'
import type { Vault } from '$lib/types/vault'
import type { OpenNoteState } from '$lib/types/editor'

type OpenNotePorts = {
  notes: NotesPort
}

type OpenNoteAppState = {
  vault: Vault | null
  open_note: OpenNoteState | null
}

type FlowContext = {
  error: string | null
  last_note_path: string | null
  ports: OpenNotePorts
  app_state: OpenNoteAppState
}

type FlowEvents =
  | { type: 'OPEN_NOTE'; note_path: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

type FlowInput = {
  ports: OpenNotePorts
  app_state: OpenNoteAppState
}

export const open_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_open: fromPromise(async ({ input }: { input: { ports: OpenNotePorts; app_state: OpenNoteAppState; note_path: string } }) => {
      const vault = input.app_state.vault
      if (!vault) throw new Error('No vault selected')
      const doc = await open_note(
        { notes: input.ports.notes },
        { vault_id: vault.id, note_id: as_note_path(input.note_path) }
      )
      input.app_state.open_note = to_open_note_state(doc)
    })
  }
}).createMachine({
  id: 'open_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    last_note_path: null,
    ports: input.ports,
    app_state: input.app_state
  }),
  states: {
    idle: {
      on: {
        OPEN_NOTE: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path
          })
        }
      }
    },
    opening: {
      invoke: {
        src: 'perform_open',
        input: ({ context }) => ({
          ports: context.ports,
          app_state: context.app_state,
          note_path: context.last_note_path!
        }),
        onDone: 'idle',
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error)
          })
        }
      }
    },
    error: {
      on: {
        RETRY: 'opening',
        CANCEL: {
          target: 'idle',
          actions: assign({
            error: () => null,
            last_note_path: () => null
          })
        }
      }
    }
  }
})

