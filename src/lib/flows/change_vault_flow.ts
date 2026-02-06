import { setup, assign, fromPromise } from 'xstate'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'
import { change_vault_use_case } from '$lib/use_cases/change_vault_use_case'
import { choose_vault_use_case } from '$lib/use_cases/choose_vault_use_case'

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
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
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
  dispatch_many: (events: AppEvent[]) => void
  now_ms: () => number
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
          dispatch_many: (events: AppEvent[]) => void
          now_ms: () => number
        }
      }) => {
        const { ports, change_mode, dispatch_many, now_ms } = input

        switch (change_mode.kind) {
          case 'choose_vault': {
            let vault_path: VaultPath | null = null
            try {
              dispatch_many([{ type: 'ui_system_dialog_set', open: true }])
              vault_path = await choose_vault_use_case({ vault: ports.vault })
            } finally {
              dispatch_many([{ type: 'ui_system_dialog_set', open: false }])
            }
            if (!vault_path) return { changed: false }
            const events = await change_vault_use_case(
              { vault: ports.vault, notes: ports.notes, index: ports.index },
              { vault_path },
              now_ms()
            )
            dispatch_many(events)
            break
          }
          case 'select_recent': {
            const events = await change_vault_use_case(
              { vault: ports.vault, notes: ports.notes, index: ports.index },
              { vault_id: change_mode.vault_id },
              now_ms()
            )
            dispatch_many(events)
            break
          }
        }

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
    dispatch_many: input.dispatch_many,
    now_ms: input.now_ms
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
        input: ({ context }) => {
          if (!context.change_mode) throw new Error('change_mode required in changing state')
          return {
            ports: context.ports,
            change_mode: context.change_mode,
            dispatch_many: context.dispatch_many,
            now_ms: context.now_ms
          }
        },
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
