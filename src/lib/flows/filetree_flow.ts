import { setup, assign, fromCallback, type AnyActorRef } from 'xstate'
import type { FolderLoadState, FolderContents } from '$lib/types/filetree'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { AppStateEvents } from '$lib/state/app_state_machine'

type FiletreePorts = {
  notes: NotesPort
}

type AppStateDispatch = (event: AppStateEvents) => void

type GetVaultId = () => VaultId | null

type FlowContext = {
  expanded_paths: Set<string>
  load_states: Map<string, FolderLoadState>
  error_messages: Map<string, string>
  active_loads: Map<string, AnyActorRef>
  ports: FiletreePorts
  dispatch: AppStateDispatch
  get_vault_id: GetVaultId
}

export type FiletreeFlowContext = FlowContext

type FlowEvents =
  | { type: 'TOGGLE_FOLDER'; path: string }
  | { type: 'EXPAND_FOLDER'; path: string }
  | { type: 'COLLAPSE_FOLDER'; path: string }
  | { type: 'REQUEST_LOAD'; path: string }
  | { type: 'FOLDER_LOAD_DONE'; path: string; contents: FolderContents }
  | { type: 'FOLDER_LOAD_ERROR'; path: string; error: string }
  | { type: 'RETRY_LOAD'; path: string }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'RESET' }
  | { type: 'VAULT_CHANGED' }

export type FiletreeFlowEvents = FlowEvents

type FlowInput = {
  ports: FiletreePorts
  dispatch: AppStateDispatch
  get_vault_id: GetVaultId
}

type LoadFolderInput = {
  ports: FiletreePorts
  vault_id: VaultId
  path: string
}

const load_folder_actor = fromCallback<FlowEvents, LoadFolderInput>(({ sendBack, input }) => {
  const { ports, vault_id, path } = input
  ports.notes.list_folder_contents(vault_id, path)
    .then((contents) => sendBack({ type: 'FOLDER_LOAD_DONE', path, contents }))
    .catch((error) => sendBack({ type: 'FOLDER_LOAD_ERROR', path, error: String(error) }))
  return () => {}
})

function should_load_folder(load_state: FolderLoadState | undefined): boolean {
  return !load_state || load_state === 'unloaded' || load_state === 'error'
}

function create_empty_state(): Pick<FlowContext, 'expanded_paths' | 'load_states' | 'error_messages' | 'active_loads'> {
  return {
    expanded_paths: new Set<string>(),
    load_states: new Map<string, FolderLoadState>(),
    error_messages: new Map<string, string>(),
    active_loads: new Map()
  }
}

export const filetree_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    load_folder: load_folder_actor
  },
  guards: {
    should_load_on_expand: ({ context, event }) => {
      if (event.type !== 'TOGGLE_FOLDER' && event.type !== 'EXPAND_FOLDER') return false
      return should_load_folder(context.load_states.get(event.path))
    },
    is_expanding: ({ context, event }) => {
      if (event.type !== 'TOGGLE_FOLDER') return false
      return !context.expanded_paths.has(event.path)
    }
  },
  actions: {
    toggle_expanded: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_FOLDER') return {}
      const new_expanded = new Set(context.expanded_paths)
      if (new_expanded.has(event.path)) {
        new_expanded.delete(event.path)
      } else {
        new_expanded.add(event.path)
      }
      return { expanded_paths: new_expanded }
    }),
    add_expanded: assign(({ context, event }) => {
      if (event.type !== 'EXPAND_FOLDER') return {}
      const new_expanded = new Set(context.expanded_paths)
      new_expanded.add(event.path)
      return { expanded_paths: new_expanded }
    }),
    remove_expanded: assign(({ context, event }) => {
      if (event.type !== 'COLLAPSE_FOLDER') return {}
      const new_expanded = new Set(context.expanded_paths)
      new_expanded.delete(event.path)
      return { expanded_paths: new_expanded }
    }),
    spawn_folder_load: assign(({ context, event, spawn }) => {
      if (event.type !== 'TOGGLE_FOLDER' && event.type !== 'EXPAND_FOLDER' &&
          event.type !== 'REQUEST_LOAD' && event.type !== 'RETRY_LOAD') return {}

      const path = event.path
      const vault_id = context.get_vault_id()
      if (!vault_id) return {}

      const current_state = context.load_states.get(path)
      if (!should_load_folder(current_state) && event.type !== 'RETRY_LOAD') return {}

      const existing = context.active_loads.get(path)
      if (existing) existing.stop?.()

      const new_load_states = new Map(context.load_states)
      new_load_states.set(path, 'loading')

      const new_active_loads = new Map(context.active_loads)
      const actor = spawn('load_folder', {
        input: { ports: context.ports, vault_id, path },
        id: `load-${path}-${Date.now()}`
      })
      new_active_loads.set(path, actor)

      return { load_states: new_load_states, active_loads: new_active_loads }
    }),
    handle_load_done: assign(({ context, event }) => {
      if (event.type !== 'FOLDER_LOAD_DONE') return {}

      const { path, contents } = event
      const new_load_states = new Map(context.load_states)
      const new_error_messages = new Map(context.error_messages)
      const new_active_loads = new Map(context.active_loads)

      new_load_states.set(path, 'loaded')
      new_error_messages.delete(path)
      new_active_loads.delete(path)

      context.dispatch({ type: 'MERGE_FOLDER_CONTENTS', folder_path: path, contents })

      return { load_states: new_load_states, error_messages: new_error_messages, active_loads: new_active_loads }
    }),
    handle_load_error: assign(({ context, event }) => {
      if (event.type !== 'FOLDER_LOAD_ERROR') return {}

      const { path, error } = event
      const new_load_states = new Map(context.load_states)
      const new_error_messages = new Map(context.error_messages)
      const new_active_loads = new Map(context.active_loads)

      new_load_states.set(path, 'error')
      new_error_messages.set(path, error)
      new_active_loads.delete(path)

      return { load_states: new_load_states, error_messages: new_error_messages, active_loads: new_active_loads }
    }),
    reset_state: assign(() => create_empty_state()),
    clear_expanded: assign(() => ({ expanded_paths: new Set<string>() })),
    load_root_folder: assign(({ context, spawn }) => {
      const vault_id = context.get_vault_id()
      if (!vault_id) return {}

      const new_load_states = new Map<string, FolderLoadState>()
      new_load_states.set('', 'loading')

      const new_active_loads = new Map()
      const actor = spawn('load_folder', {
        input: { ports: context.ports, vault_id, path: '' },
        id: `load-root-${Date.now()}`
      })
      new_active_loads.set('', actor)

      return { load_states: new_load_states, active_loads: new_active_loads }
    })
  }
}).createMachine({
  id: 'filetree_flow',
  initial: 'active',
  context: ({ input }) => ({
    ...create_empty_state(),
    ports: input.ports,
    dispatch: input.dispatch,
    get_vault_id: input.get_vault_id
  }),
  states: {
    active: {
      on: {
        VAULT_CHANGED: {
          actions: ['reset_state', 'load_root_folder']
        },
        TOGGLE_FOLDER: [
          {
            guard: 'is_expanding',
            actions: ['toggle_expanded', 'spawn_folder_load']
          },
          {
            actions: 'toggle_expanded'
          }
        ],
        EXPAND_FOLDER: {
          actions: ['add_expanded', 'spawn_folder_load']
        },
        COLLAPSE_FOLDER: {
          actions: 'remove_expanded'
        },
        REQUEST_LOAD: {
          actions: 'spawn_folder_load'
        },
        FOLDER_LOAD_DONE: {
          actions: 'handle_load_done'
        },
        FOLDER_LOAD_ERROR: {
          actions: 'handle_load_error'
        },
        RETRY_LOAD: {
          actions: 'spawn_folder_load'
        },
        COLLAPSE_ALL: {
          actions: 'clear_expanded'
        },
        RESET: {
          actions: 'reset_state'
        }
      }
    }
  }
})
