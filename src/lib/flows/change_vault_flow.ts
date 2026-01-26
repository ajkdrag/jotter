import { setup, assign, fromPromise } from 'xstate'
import { change_vault } from '$lib/operations/change_vault'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type ChangeVaultPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type ChangeMode =
  | { kind: 'choose_vault' }
  | { kind: 'select_recent'; vault_id: VaultId }

type FlowContext = {
  error: string | null
  change_mode: ChangeMode | null
  ports: ChangeVaultPorts
  dispatch: AppStateDispatch
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
  dispatch: AppStateDispatch
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
          dispatch: AppStateDispatch
        }
      }) => {
        const { ports, change_mode, dispatch } = input

        let result: { vault: Vault; notes: NoteMeta[] } | null = null

        switch (change_mode.kind) {
          case 'choose_vault': {
            const vault_path = await ports.vault.choose_vault()
            if (!vault_path) return { changed: false }
            result = await change_vault({ vault: ports.vault, notes: ports.notes }, { vault_path })
            break
          }
          case 'select_recent': {
            const vault = await ports.vault.open_vault_by_id(change_mode.vault_id)
            const notes = await ports.notes.list_notes(vault.id)
            await ports.vault.remember_last_vault(vault.id)
            result = { vault, notes }
            break
          }
        }

        if (!result) throw new Error('Invariant violation: vault change result missing')

        void ports.index.build_index(result.vault.id)
        const recent_vaults = await ports.vault.list_vaults()
        dispatch({ type: 'SET_ACTIVE_VAULT', vault: result.vault, notes: result.notes })
        dispatch({ type: 'SET_RECENT_VAULTS', recent_vaults })

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
    dispatch: input.dispatch
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
          dispatch: context.dispatch
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
