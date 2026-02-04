import { setup, assign, fromPromise } from 'xstate'
import { change_vault } from '$lib/operations/change_vault'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { AppStores } from '$lib/stores/create_app_stores'

type ChangeVaultPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
}

type ChangeMode =
  | { kind: 'choose_vault' }
  | { kind: 'select_recent'; vault_id: VaultId }

type FlowContext = {
  error: string | null
  change_mode: ChangeMode | null
  ports: ChangeVaultPorts
  stores: AppStores
}

export type ChangeVaultFlowContext = FlowContext

type FlowEvents =
  | { type: 'OPEN_DIALOG' }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'CHOOSE_VAULT' }
  | { type: 'SELECT_VAULT'; vault_id: VaultId }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export type ChangeVaultFlowEvents = FlowEvents

type FlowInput = {
  ports: ChangeVaultPorts
  stores: AppStores
}

export const change_vault_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    perform_change: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: ChangeVaultPorts
          change_mode: ChangeMode
          stores: AppStores
        }
      }) => {
        const { ports, change_mode, stores } = input

        let result: { vault: Vault; notes: NoteMeta[]; folder_paths: string[] } | null = null

        switch (change_mode.kind) {
          case 'choose_vault': {
            stores.ui.actions.set_system_dialog_open(true)
            let vault_path: VaultPath | null = null
            try {
              vault_path = await ports.vault.choose_vault()
            } finally {
              stores.ui.actions.set_system_dialog_open(false)
            }
            if (!vault_path) return { changed: false }
            result = await change_vault({ vault: ports.vault, notes: ports.notes }, { vault_path })
            break
          }
          case 'select_recent': {
            result = await change_vault({ vault: ports.vault, notes: ports.notes }, { vault_id: change_mode.vault_id })
            break
          }
        }

        if (!result) throw new Error('Invariant violation: vault change result missing')

        void ports.index.build_index(result.vault.id)
        const recent_vaults = await ports.vault.list_vaults()

        stores.vault.actions.set_vault(result.vault)
        stores.notes.actions.set_notes(result.notes)
        stores.notes.actions.set_folder_paths(result.folder_paths)
        stores.editor.actions.clear_open_note()
        stores.editor.actions.ensure_open_note(result.vault, result.notes, stores.now_ms())
        stores.vault.actions.set_recent_vaults(recent_vaults)

        return { changed: true }
      }
    )
  }
}).createMachine({
  id: 'change_vault_flow',
  initial: 'idle',
  context: ({ input }) => ({
    error: null,
    change_mode: null,
    ports: input.ports,
    stores: input.stores
  }),
  states: {
    idle: {
      entry: assign({ error: () => null, change_mode: () => null }),
      on: {
        OPEN_DIALOG: 'dialog_open',
        CHOOSE_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: () => ({ kind: 'choose_vault' }) })
        },
        SELECT_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: ({ event }) => ({ kind: 'select_recent', vault_id: event.vault_id }) })
        }
      }
    },
    dialog_open: {
      on: {
        CLOSE_DIALOG: 'idle',
        CHOOSE_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: () => ({ kind: 'choose_vault' }) })
        },
        SELECT_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: ({ event }) => ({ kind: 'select_recent', vault_id: event.vault_id }) })
        }
      }
    },
    changing: {
      invoke: {
        src: 'perform_change',
        input: ({ context }) => ({
          ports: context.ports,
          change_mode: context.change_mode!,
          stores: context.stores
        }),
        onDone: 'idle',
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    error: {
      on: {
        RETRY: 'changing',
        CANCEL: {
          target: 'idle',
          actions: assign({ error: () => null, change_mode: () => null })
        },
        CLOSE_DIALOG: {
          target: 'idle',
          actions: assign({ error: () => null, change_mode: () => null })
        }
      }
    }
  }
})
