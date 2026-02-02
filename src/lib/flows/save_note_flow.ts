import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { AppStateEvents, AppStateContext } from '$lib/state/app_state_machine'
import type { FlowSnapshot } from '$lib/flows/flow_handle'
import type { NotePath } from '$lib/types/ids'
import { as_note_path } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import { sanitize_note_name } from '$lib/utils/sanitize_note_name'

type SaveNotePorts = {
  notes: NotesPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type GetAppStateSnapshot = () => FlowSnapshot<AppStateContext>

type FlowContext = {
  error: string | null
  new_path: NotePath | null
  folder_path: string
  target_exists: boolean
  requires_dialog: boolean
  ports: SaveNotePorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
  on_save_complete: (() => void) | undefined
}

export type SaveNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_SAVE' }
  | { type: 'UPDATE_NEW_PATH'; path: NotePath }
  | { type: 'CONFIRM' }
  | { type: 'CONFIRM_OVERWRITE' }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export type SaveNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: SaveNotePorts
  dispatch: AppStateDispatch
  get_app_state_snapshot: GetAppStateSnapshot
  on_save_complete?: () => void
}

function get_filename_from_path(path: string): string {
  const last_slash = path.lastIndexOf('/')
  return last_slash >= 0 ? path.substring(last_slash + 1) : path
}

function build_full_path(folder: string, filename: string): NotePath {
  const sanitized = sanitize_note_name(filename)
  const full = folder ? `${folder}/${sanitized}` : sanitized
  return as_note_path(full)
}

export const save_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  guards: {
    is_untitled: ({ context }) => {
      const app_snapshot = context.get_app_state_snapshot()
      const open_note = app_snapshot.context.open_note
      if (!open_note) return false
      return !open_note.meta.path.endsWith('.md')
    }
  },
  actors: {
    check_path_exists: fromPromise(
      async ({
        input
      }: {
        input: {
          notes: NoteMeta[]
          new_path: NotePath
        }
      }) => {
        const { notes, new_path } = input
        const normalized = new_path.endsWith('.md') ? new_path : `${new_path}.md`
        return notes.some(note => note.path === normalized)
      }
    ),
    perform_save: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: SaveNotePorts
          dispatch: AppStateDispatch
          get_app_state_snapshot: GetAppStateSnapshot
          new_path: NotePath | null
        }
      }) => {
        const { ports, dispatch, get_app_state_snapshot, new_path } = input

        const app_snapshot = get_app_state_snapshot()
        const { vault, open_note } = app_snapshot.context

        if (!vault || !open_note) return

        const is_untitled = !open_note.meta.path.endsWith('.md')

        if (is_untitled && new_path) {
          const new_note_meta = await ports.notes.create_note(vault.id, new_path, open_note.markdown)
          dispatch({ type: 'UPDATE_OPEN_NOTE_PATH', path: new_path })
          dispatch({ type: 'ADD_NOTE_TO_LIST', note: new_note_meta })
        } else {
          await ports.notes.write_note(vault.id, open_note.meta.id, open_note.markdown)
        }
      }
    )
  }
}).createMachine({
  id: 'save_note_flow',
  initial: 'idle',
  context: ({ input }): FlowContext => ({
    error: null,
    new_path: null,
    folder_path: '',
    target_exists: false,
    requires_dialog: false,
    ports: input.ports,
    dispatch: input.dispatch,
    get_app_state_snapshot: input.get_app_state_snapshot,
    on_save_complete: input.on_save_complete
  }),
  states: {
    idle: {
      on: {
        REQUEST_SAVE: [
          {
            target: 'showing_save_dialog',
            guard: 'is_untitled',
            actions: assign(({ context }) => {
              const app_snapshot = context.get_app_state_snapshot()
              const open_note = app_snapshot.context.open_note
              const current_path = open_note?.meta.path ?? ''
              const folder = app_snapshot.context.selected_folder_path
              const filename = get_filename_from_path(current_path) || 'Untitled'
              return {
                error: null,
                folder_path: folder,
                new_path: build_full_path(folder, filename),
                target_exists: false,
                requires_dialog: true
              }
            })
          },
          {
            target: 'saving',
            actions: assign({
              error: () => null
            })
          }
        ]
      }
    },
    showing_save_dialog: {
      on: {
        UPDATE_NEW_PATH: {
          actions: assign({
            new_path: ({ event }) => event.path
          })
        },
        CONFIRM: {
          target: 'checking_existence',
          actions: assign(({ context }) => {
            const path = context.new_path ? String(context.new_path) : ''
            const filename = get_filename_from_path(path)
            return {
              new_path: build_full_path(context.folder_path, filename)
            }
          })
        },
        CANCEL: {
          target: 'idle',
          actions: assign({
            new_path: () => null,
            folder_path: () => '',
            target_exists: () => false,
            requires_dialog: () => false,
            error: () => null
          })
        }
      }
    },
    checking_existence: {
      invoke: {
        src: 'check_path_exists',
        input: ({ context }) => {
          const app_snapshot = context.get_app_state_snapshot()
          return {
            notes: app_snapshot.context.notes,
            new_path: context.new_path!
          }
        },
        onDone: {
          target: 'existence_check_done',
          actions: assign({
            target_exists: ({ event }) => event.output
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
    existence_check_done: {
      always: [
        { target: 'conflict_confirm', guard: ({ context }) => context.target_exists },
        { target: 'saving' }
      ]
    },
    conflict_confirm: {
      on: {
        CONFIRM_OVERWRITE: 'saving',
        CANCEL: {
          target: 'showing_save_dialog',
          actions: assign({
            target_exists: () => false
          })
        }
      }
    },
    saving: {
      invoke: {
        src: 'perform_save',
        input: ({ context }) => ({
          ports: context.ports,
          dispatch: context.dispatch,
          get_app_state_snapshot: context.get_app_state_snapshot,
          new_path: context.new_path
        }),
        onDone: {
          target: 'idle',
          actions: [
            assign({
              new_path: () => null,
              folder_path: () => '',
              target_exists: () => false,
              requires_dialog: () => false
            }),
            ({ context }) => {
              context.on_save_complete?.()
            }
          ]
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
        RETRY: {
          target: 'saving',
          actions: assign({
            error: () => null
          })
        },
        CANCEL: {
          target: 'idle',
          actions: assign({
            new_path: () => null,
            folder_path: () => '',
            target_exists: () => false,
            requires_dialog: () => false,
            error: () => null
          })
        }
      }
    }
  }
})
