import { setup, assign, fromPromise } from 'xstate'
import { rename_note } from '$lib/operations/rename_note'
import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { AppStores } from '$lib/stores/create_app_stores'
import { note_path_exists } from '$lib/utils/note_path_exists'

type RenameNotePorts = {
  notes: NotesPort
  index: WorkspaceIndexPort
}

type FlowContext = {
  note_to_rename: NoteMeta | null
  vault_id: VaultId | null
  new_path: NotePath | null
  is_note_currently_open: boolean
  error: string | null
  target_exists: boolean
  ports: RenameNotePorts
  stores: AppStores
}

export type RenameNoteFlowContext = FlowContext

type FlowEvents =
  | { type: 'REQUEST_RENAME'; vault_id: VaultId; note: NoteMeta; is_note_currently_open: boolean }
  | { type: 'UPDATE_NEW_PATH'; path: NotePath }
  | { type: 'CONFIRM' }
  | { type: 'CONFIRM_OVERWRITE' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export type RenameNoteFlowEvents = FlowEvents

type FlowInput = {
  ports: RenameNotePorts
  stores: AppStores
}

export const rename_note_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    check_path_exists: fromPromise(
      ({
        input
      }: {
        input: {
          notes: NoteMeta[]
          new_path: NotePath
        }
      }) => {
        const { notes, new_path } = input
        return Promise.resolve(note_path_exists(notes, new_path))
      }
    ),
    perform_rename: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: RenameNotePorts
          stores: AppStores
          vault_id: VaultId
          note: NoteMeta
          new_path: NotePath
          is_note_currently_open: boolean
        }
      }) => {
        const { ports, stores, vault_id, note, new_path, is_note_currently_open } = input

        await rename_note(ports, { vault_id, from: note.path, to: new_path })

        stores.notes.actions.rename_note(note.path, new_path)

        if (is_note_currently_open) {
          stores.editor.actions.update_path(new_path)
        }

        await ports.index.remove_note(vault_id, note.id)
        await ports.index.upsert_note(vault_id, new_path)
      }
    )
  }
}).createMachine({
  id: 'rename_note_flow',
  initial: 'idle',
  context: ({ input }) => ({
    note_to_rename: null,
    vault_id: null,
    new_path: null,
    is_note_currently_open: false,
    error: null,
    target_exists: false,
    ports: input.ports,
    stores: input.stores
  }),
  states: {
    idle: {
      on: {
        REQUEST_RENAME: {
          target: 'confirming',
          actions: assign({
            note_to_rename: ({ event }) => event.note,
            vault_id: ({ event }) => event.vault_id,
            is_note_currently_open: ({ event }) => event.is_note_currently_open,
            new_path: ({ event }) => event.note.path,
            error: () => null,
            target_exists: () => false
          })
        }
      }
    },
    confirming: {
      on: {
        UPDATE_NEW_PATH: {
          actions: assign({
            new_path: ({ event }) => event.path
          })
        },
        CONFIRM: 'checking_conflict',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_rename: () => null,
            vault_id: () => null,
            new_path: () => null,
            is_note_currently_open: () => false,
            error: () => null,
            target_exists: () => false
          })
        }
      }
    },
    checking_conflict: {
      invoke: {
        src: 'check_path_exists',
        input: ({ context }) => {
          if (!context.new_path) throw new Error('new_path required in checking_conflict state')
          const notes = context.stores.notes.get_snapshot().notes
          return {
            notes,
            new_path: context.new_path
          }
        },
        onDone: {
          target: 'conflict_check_done',
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
    conflict_check_done: {
      always: [
        { target: 'conflict_confirm', guard: ({ context }) => context.target_exists },
        { target: 'renaming' }
      ]
    },
    conflict_confirm: {
      on: {
        CONFIRM_OVERWRITE: 'renaming',
        CANCEL: {
          target: 'confirming',
          actions: assign({
            target_exists: () => false
          })
        }
      }
    },
    renaming: {
      invoke: {
        src: 'perform_rename',
        input: ({ context }) => {
          if (!context.vault_id) throw new Error('vault_id required in renaming state')
          if (!context.note_to_rename) throw new Error('note_to_rename required in renaming state')
          if (!context.new_path) throw new Error('new_path required in renaming state')
          return {
            ports: context.ports,
            stores: context.stores,
            vault_id: context.vault_id,
            note: context.note_to_rename,
            new_path: context.new_path,
            is_note_currently_open: context.is_note_currently_open
          }
        },
        onDone: {
          target: 'idle',
          actions: assign({
            note_to_rename: () => null,
            vault_id: () => null,
            new_path: () => null,
            is_note_currently_open: () => false,
            target_exists: () => false
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
        RETRY: 'checking_conflict',
        CANCEL: {
          target: 'idle',
          actions: assign({
            note_to_rename: () => null,
            vault_id: () => null,
            new_path: () => null,
            is_note_currently_open: () => false,
            error: () => null,
            target_exists: () => false
          })
        }
      }
    }
  }
})
