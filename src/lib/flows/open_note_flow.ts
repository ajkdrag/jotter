import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import type { AppEvent } from '$lib/events/app_event'
import { open_note_use_case } from '$lib/use_cases/open_note_use_case'
import { create_untitled_note_use_case } from '$lib/use_cases/create_untitled_note_use_case'

type OpenNotePorts = {
  notes: NotesPort
}

type FlowContext = {
  error: string | null
  last_note_path: NotePath | null
  last_vault_id: VaultId | null
  create_if_missing: boolean
  ports: OpenNotePorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

export type OpenNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN_NOTE'; vault_id: VaultId; note_path: NotePath }
  | { type: 'OPEN_WIKI_LINK'; vault_id: VaultId; note_path: NotePath }
  | { type: 'CREATE_NEW_NOTE'; folder_prefix: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export type OpenNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: OpenNotePorts
  stores: AppStores
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
}

export const open_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_open: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: OpenNotePorts
          stores: AppStores
          vault_id: VaultId
          note_path: NotePath
          create_if_missing: boolean
        }
      }): Promise<AppEvent[]> => {
        const notes = input.stores.notes.get_snapshot().notes
        return await open_note_use_case(
          { notes: input.ports.notes },
          { vault_id: input.vault_id, note_path: input.note_path, create_if_missing: input.create_if_missing, known_notes: notes }
        )
      }
    )
  }
}).createMachine({
  id: 'open_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    last_note_path: null,
    last_vault_id: null,
    create_if_missing: false,
    ports: input.ports,
    stores: input.stores,
    dispatch_many: input.dispatch_many,
    now_ms: input.now_ms
  }),
  states: {
    idle: {
      on: {
        CREATE_NEW_NOTE: {
          actions: ({ context, event }) => {
            const notes = context.stores.notes.get_snapshot().notes
            const events = create_untitled_note_use_case({
              notes,
              folder_prefix: event.folder_prefix,
              now_ms: context.now_ms()
            })
            context.dispatch_many(events)
          }
        },
        OPEN_NOTE: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id,
            create_if_missing: () => false
          })
        },
        OPEN_WIKI_LINK: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id,
            create_if_missing: () => true
          })
        }
      }
    },
    opening: {
      on: {
        OPEN_NOTE: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id,
            create_if_missing: () => false
          })
        },
        OPEN_WIKI_LINK: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id,
            create_if_missing: () => true
          })
        }
      },
      invoke: {
        src: 'perform_open',
        input: ({ context }) => {
          if (!context.last_vault_id) throw new Error('last_vault_id required in opening state')
          if (!context.last_note_path) throw new Error('last_note_path required in opening state')
          return {
            ports: context.ports,
            stores: context.stores,
            vault_id: context.last_vault_id,
            note_path: context.last_note_path,
            create_if_missing: context.create_if_missing
          }
        },
        onDone: {
          target: 'idle',
          actions: ({ context, event }) => {
            context.dispatch_many(event.output)
          }
        },
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
        OPEN_NOTE: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id,
            create_if_missing: () => false
          })
        },
        OPEN_WIKI_LINK: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id,
            create_if_missing: () => true
          })
        },
        RETRY: 'opening',
        CANCEL: {
          target: 'idle',
          actions: assign({
            error: () => null,
            last_note_path: () => null,
            last_vault_id: () => null,
            create_if_missing: () => false
          })
        }
      }
    }
  }
})
