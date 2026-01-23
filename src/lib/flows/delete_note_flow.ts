import { setup, assign, fromPromise } from 'xstate'
import { delete_note } from '$lib/operations/delete_note'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'
import type { Vault } from '$lib/types/vault'
import { as_markdown_text, as_note_path } from '$lib/types/ids'

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
}

type FlowEvents =
  | { type: 'REQUEST_DELETE'; note: NoteMeta }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

type FlowInput = {
  ports: DeleteNotePorts
  app_state: DeleteNoteAppState
}

function next_untitled_name(notes: NoteMeta[]): string {
  let max = 0
  for (const note of notes) {
    const match = String(note.path).match(/^Untitled-(\d+)$/)
    if (!match) continue
    const value = Number(match[1])
    if (!Number.isFinite(value)) continue
    if (value > max) max = value
  }
  return `Untitled-${max + 1}`
}

function create_untitled_note(notes: NoteMeta[], now: number): OpenNoteState {
  const name = next_untitled_name(notes)
  return {
    meta: {
      id: as_note_path(name),
      path: as_note_path(name),
      title: name,
      mtime_ms: now,
      size_bytes: 0
    },
    markdown: as_markdown_text(''),
    dirty: false,
    last_saved_at_ms: now
  }
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
        input: { ports: DeleteNotePorts; app_state: DeleteNoteAppState; note: NoteMeta }
      }) => {
        const { ports, app_state, note } = input
        if (!app_state.vault) throw new Error('No vault selected')

        await delete_note(ports, {
          vault_id: app_state.vault.id,
          note_id: note.id
        })

        app_state.notes = app_state.notes.filter((n) => n.id !== note.id)

        const was_open = app_state.open_note?.meta.id === note.id
        if (was_open) {
          app_state.open_note = create_untitled_note(app_state.notes, Date.now())
        }

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
    app_state: input.app_state
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
          note: context.note_to_delete!
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
