import { setup, assign, fromPromise } from 'xstate'
import { open_note } from '$lib/operations/open_note'
import { to_open_note_state } from '$lib/types/editor'
import { as_note_path } from '$lib/types/ids'
import { parent_folder_path } from '$lib/utils/filetree'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'

type OpenNotePorts = {
  notes: NotesPort
}

type FlowContext = {
  error: string | null
  last_note_path: string | null
  last_vault_id: VaultId | null
  ports: OpenNotePorts
  stores: AppStores
}

export type OpenNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN_NOTE'; vault_id: VaultId; note_path: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export type OpenNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: OpenNotePorts
  stores: AppStores
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
        input: { ports: OpenNotePorts; stores: AppStores; vault_id: VaultId; note_path: string }
      }) => {
        const doc = await open_note(
          { notes: input.ports.notes },
          { vault_id: input.vault_id, note_id: as_note_path(input.note_path) }
        )
        const parent_path = parent_folder_path(as_note_path(input.note_path))
        input.stores.ui.actions.set_selected_folder_path(parent_path)
        input.stores.editor.actions.set_open_note(to_open_note_state(doc))
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
    ports: input.ports,
    stores: input.stores
  }),
  states: {
    idle: {
      on: {
        OPEN_NOTE: {
          target: 'opening',
          actions: assign({
            error: () => null,
            last_note_path: ({ event }) => event.note_path,
            last_vault_id: ({ event }) => event.vault_id
          })
        }
      }
    },
    opening: {
      invoke: {
        src: 'perform_open',
        input: ({ context }) => ({
          ports: context.ports,
          stores: context.stores,
          vault_id: context.last_vault_id!,
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
            last_note_path: () => null,
            last_vault_id: () => null
          })
        }
      }
    }
  }
})
