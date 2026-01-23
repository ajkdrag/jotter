import { setup, assign, fromPromise } from 'xstate'
import { change_vault } from '$lib/operations/change_vault'
import { open_last_vault } from '$lib/operations/open_last_vault'
import { ensure_open_note } from '$lib/operations/ensure_open_note'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NavigationPort } from '$lib/ports/navigation_port'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import type { OpenNoteState } from '$lib/types/editor'

type ChangeVaultPorts = {
  vault: VaultPort
  notes: NotesPort
  index: WorkspaceIndexPort
  navigation: NavigationPort
}

type ChangeVaultAppState = {
  vault: Vault | null
  recent_vaults: Vault[]
  notes: NoteMeta[]
  open_note: OpenNoteState | null
}

type ChangeMode =
  | { kind: 'choose_vault' }
  | { kind: 'select_recent'; vault_id: VaultId }
  | { kind: 'open_last' }
  | { kind: 'bootstrap_default'; vault_path: VaultPath }

type FlowContext = {
  error: string | null
  change_mode: ChangeMode | null
  ports: ChangeVaultPorts
  app_state: ChangeVaultAppState
  now_ms: () => number
}

type FlowEvents =
  | { type: 'OPEN_DIALOG' }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'LOAD_RECENT' }
  | { type: 'CHOOSE_VAULT' }
  | { type: 'SELECT_VAULT'; vault_id: VaultId }
  | { type: 'OPEN_LAST_VAULT' }
  | { type: 'BOOTSTRAP_DEFAULT_VAULT'; vault_path: VaultPath }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

type FlowInput = {
  ports: ChangeVaultPorts
  app_state: ChangeVaultAppState
  now_ms?: () => number
}

async function refresh_recent(ports: ChangeVaultPorts, app_state: ChangeVaultAppState) {
  app_state.recent_vaults = await ports.vault.list_vaults()
}

export const change_vault_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    load_recent: fromPromise(async ({ input }: { input: { ports: ChangeVaultPorts; app_state: ChangeVaultAppState } }) => {
      await refresh_recent(input.ports, input.app_state)
    }),
    perform_change: fromPromise(
      async ({
        input
      }: {
        input: {
          ports: ChangeVaultPorts
          app_state: ChangeVaultAppState
          change_mode: ChangeMode
          now_ms: () => number
        }
      }) => {
        const { ports, app_state, change_mode } = input

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
          case 'open_last': {
            result = await open_last_vault({ vault: ports.vault, notes: ports.notes })
            if (!result) return { changed: false }
            break
          }
          case 'bootstrap_default': {
            result = await change_vault(
              { vault: ports.vault, notes: ports.notes },
              { vault_path: change_mode.vault_path }
            )
            break
          }
        }

        if (!result) throw new Error('Invariant violation: vault change result missing')

        app_state.vault = result.vault
        app_state.notes = result.notes
        app_state.open_note = ensure_open_note({
          vault: app_state.vault,
          notes: app_state.notes,
          open_note: null,
          now_ms: input.now_ms()
        })

        void ports.index.build_index(result.vault.id)
        await refresh_recent(ports, app_state)
        await ports.navigation.navigate_to_home()

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
    app_state: input.app_state,
    now_ms: input.now_ms ?? (() => Date.now())
  }),
  states: {
    idle: {
      entry: assign({ error: () => null, change_mode: () => null }),
      on: {
        OPEN_DIALOG: 'dialog_open',
        LOAD_RECENT: 'loading_recent',
        CHOOSE_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: () => ({ kind: 'choose_vault' }) })
        },
        SELECT_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: ({ event }) => ({ kind: 'select_recent', vault_id: event.vault_id }) })
        },
        OPEN_LAST_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: () => ({ kind: 'open_last' }) })
        },
        BOOTSTRAP_DEFAULT_VAULT: {
          target: 'changing',
          actions: assign({ change_mode: ({ event }) => ({ kind: 'bootstrap_default', vault_path: event.vault_path }) })
        }
      }
    },
    dialog_open: {
      on: {
        CLOSE_DIALOG: 'idle',
        LOAD_RECENT: 'loading_recent',
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
    loading_recent: {
      invoke: {
        src: 'load_recent',
        input: ({ context }) => ({ ports: context.ports, app_state: context.app_state }),
        onDone: 'idle',
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    changing: {
      invoke: {
        src: 'perform_change',
        input: ({ context }) => ({
          ports: context.ports,
          app_state: context.app_state,
          change_mode: context.change_mode!,
          now_ms: context.now_ms
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
