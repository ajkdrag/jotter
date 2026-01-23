import { setup, assign, fromPromise } from 'xstate'
import { delete_note } from '$lib/operations/delete_note'
import { ensure_open_note } from '$lib/operations/ensure_open_note'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'

type DeleteNotePorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type DeleteNoteAppState = {
  vault: Vault | null
  notes: NoteMeta[]
  open_note: OpenNoteState | null
}

type FlowContext = {
  note_to_delete: NoteMeta | null
  error: string | null
  ports: DeleteNotePorts
  app_state: DeleteNoteAppState
  now_ms: () => number
}

type FlowEvents =
  | { type: 'REQUEST_DELETE'; note: NoteMeta }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

type FlowInput = {
  ports: DeleteNotePorts
  app_state: DeleteNoteAppState
  now_ms?: () => number
}

export const delete_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_delete: fromPromise(
      async ({
        input
      }: {
        input: { ports: DeleteNotePorts; app_state: DeleteNoteAppState; note: NoteMeta; now_ms: () => number }
      }) => {
        const { ports, app_state, note } = input
        if (!app_state.vault) throw new Error('No vault selected')

        await delete_note(ports, {
          vault_id: app_state.vault.id,
          note_id: note.id
        })

        app_state.notes = await ports.notes.list_notes(app_state.vault.id)

        const was_open = app_state.open_note?.meta.id === note.id
        if (was_open) app_state.open_note = null
        app_state.open_note = ensure_open_note({
          vault: app_state.vault,
          notes: app_state.notes,
          open_note: app_state.open_note,
          now_ms: input.now_ms()
        })

        void ports.index.build_index(app_state.vault.id)
      }
    )
  }
}).createMachine({
  id: 'delete_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    note_to_delete: null,
    error: null,
    ports: input.ports,
    app_state: input.app_state,
    now_ms: input.now_ms ?? (() => Date.now())
  }),
  states: {
    idle: {
      on: {
        REQUEST_DELETE: {
          target: 'confirming',
          actions: assign({
            note_to_delete: ({ event }) => event.note,
            error: () => null
          })
        }
      }
    },
    confirming: {
      on: {
        CONFIRM: 'deleting',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_delete: () => null
          })
        }
      }
    },
    deleting: {
      invoke: {
        src: 'perform_delete',
        input: ({ context }) => ({
          ports: context.ports,
          app_state: context.app_state,
          note: context.note_to_delete!,
          now_ms: context.now_ms
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            note_to_delete: () => null
          })
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
        RETRY: 'deleting',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_delete: () => null,
            error: () => null
          })
        }
      }
    }
  }
})
