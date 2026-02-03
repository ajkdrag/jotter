import { setup, assign, fromPromise } from 'xstate'
import { open_note_or_create } from '$lib/operations/open_note_or_create'
import { to_open_note_state } from '$lib/types/editor'
import { parent_folder_path } from '$lib/utils/filetree'
import { resolve_existing_note_path } from '$lib/utils/note_lookup'
import { as_note_path } from '$lib/types/ids'
import type { NotesPort } from '$lib/ports/notes_port'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'

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
}

export type OpenNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN_NOTE'; vault_id: VaultId; note_path: NotePath }
  | { type: 'OPEN_WIKI_LINK'; vault_id: VaultId; note_path: NotePath }
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
        input: {
          ports: OpenNotePorts
          stores: AppStores
          vault_id: VaultId
          note_path: NotePath
          create_if_missing: boolean
        }
      }) => {
        const notes = input.stores.notes.get_snapshot().notes
        const resolved = input.create_if_missing
          ? resolve_existing_note_path(notes, input.note_path)
          : null
        const resolved_path = resolved ? as_note_path(resolved) : input.note_path

        const result = await open_note_or_create(
          { notes: input.ports.notes },
          { vault_id: input.vault_id, note_path: resolved_path, create_if_missing: input.create_if_missing }
        )

        const parent_path = parent_folder_path(resolved_path)
        input.stores.ui.actions.set_selected_folder_path(parent_path)
        if (result.created) {
          input.stores.notes.actions.add_note(result.doc.meta)
        }
        input.stores.editor.actions.set_open_note(to_open_note_state(result.doc))
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
        input: ({ context }) => ({
          ports: context.ports,
          stores: context.stores,
          vault_id: context.last_vault_id!,
          note_path: context.last_note_path!,
          create_if_missing: context.create_if_missing
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
