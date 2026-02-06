import { setup, assign, fromCallback, enqueueActions, type AnyActorRef } from 'xstate'
import type { FolderLoadState } from '$lib/types/filetree'
import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'
import { load_folder_contents_use_case } from '$lib/use_cases/load_folder_contents_use_case'

type FiletreePorts = {
  notes: NotesPort
}

type GetVaultId = () => VaultId | null
type GetVaultGeneration = () => number

type FlowContext = {
  expanded_paths: Set<string>
  load_states: Map<string, FolderLoadState>
  error_messages: Map<string, string>
  active_loads: Map<string, AnyActorRef>
  ports: FiletreePorts
  get_vault_id: GetVaultId
  get_vault_generation: GetVaultGeneration
  dispatch_many: (events: AppEvent[]) => void
}

export type FiletreeFlowContext = FlowContext

type FlowEvents =
  | { type: 'TOGGLE_FOLDER'; path: string }
  | { type: 'EXPAND_FOLDER'; path: string }
  | { type: 'COLLAPSE_FOLDER'; path: string }
  | { type: 'REQUEST_LOAD'; path: string }
  | { type: 'FOLDER_LOAD_DONE'; path: string; generation: number; events: AppEvent[] }
  | { type: 'FOLDER_LOAD_ERROR'; path: string; generation: number; error: string }
  | { type: 'RETRY_LOAD'; path: string }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'RESET' }
  | { type: 'VAULT_CHANGED' }

export type FiletreeFlowEvents = FlowEvents

type FlowInput = {
  ports: FiletreePorts
  get_vault_id: GetVaultId
  get_vault_generation: GetVaultGeneration
  dispatch_many: (events: AppEvent[]) => void
}

type LoadFolderInput = {
  ports: FiletreePorts
  vault_id: VaultId
  generation: number
  path: string
}

const load_folder_actor = fromCallback<FlowEvents, LoadFolderInput>(({ sendBack, input, self }) => {
  const { ports, vault_id, generation, path } = input
  let active = true
  const parent = (self as { _parent?: { getSnapshot: () => { status: string } } })._parent

  const send_if_active = (event: FlowEvents) => {
    if (!active) return
    if (parent?.getSnapshot().status === 'stopped') return
    sendBack(event)
  }

  load_folder_contents_use_case(
    { notes: ports.notes },
    { vault_id, folder_path: path }
  )
    .then((events) => {
      send_if_active({ type: 'FOLDER_LOAD_DONE', path, generation, events })
    })
    .catch((error: unknown) => {
      send_if_active({ type: 'FOLDER_LOAD_ERROR', path, generation, error: String(error) })
    })

  return () => {
    active = false
  }
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
      const generation = context.get_vault_generation()

      const current_state = context.load_states.get(path)
      if (!should_load_folder(current_state) && event.type !== 'RETRY_LOAD') return {}

      const new_load_states = new Map(context.load_states)
      new_load_states.set(path, 'loading')

      const new_active_loads = new Map(context.active_loads)
      const actor = spawn('load_folder', {
        input: { ports: context.ports, vault_id, generation, path },
        id: `load-${path}-${String(Date.now())}`
      })
      new_active_loads.set(path, actor)

      return { load_states: new_load_states, active_loads: new_active_loads }
    }),
    handle_load_done: assign(({ context, event }) => {
      if (event.type !== 'FOLDER_LOAD_DONE') return {}

      const { path, events } = event
      const new_load_states = new Map(context.load_states)
      const new_error_messages = new Map(context.error_messages)
      const new_active_loads = new Map(context.active_loads)
      if (event.generation !== context.get_vault_generation()) {
        new_active_loads.delete(path)
        return { active_loads: new_active_loads }
      }

      new_load_states.set(path, 'loaded')
      new_error_messages.delete(path)
      new_active_loads.delete(path)

      context.dispatch_many(events)

      return { load_states: new_load_states, error_messages: new_error_messages, active_loads: new_active_loads }
    }),
    handle_load_error: assign(({ context, event }) => {
      if (event.type !== 'FOLDER_LOAD_ERROR') return {}

      const { path, error } = event
      const new_load_states = new Map(context.load_states)
      const new_error_messages = new Map(context.error_messages)
      const new_active_loads = new Map(context.active_loads)
      if (event.generation !== context.get_vault_generation()) {
        new_active_loads.delete(path)
        return { active_loads: new_active_loads }
      }

      new_load_states.set(path, 'error')
      new_error_messages.set(path, error)
      new_active_loads.delete(path)

      return { load_states: new_load_states, error_messages: new_error_messages, active_loads: new_active_loads }
    }),
    stop_active_loads: enqueueActions(({ context, enqueue }) => {
      context.active_loads.forEach((actor) => {
        enqueue.stopChild(actor)
      })
    }),
    reset_state: assign(() => create_empty_state()),
    clear_expanded: assign(() => ({ expanded_paths: new Set<string>() })),
    load_root_folder: assign(({ context, spawn }) => {
      const vault_id = context.get_vault_id()
      if (!vault_id) return {}
      const generation = context.get_vault_generation()

      const new_load_states = new Map<string, FolderLoadState>()
      new_load_states.set('', 'loading')

      const new_active_loads = new Map<string, AnyActorRef>()
      const actor = spawn('load_folder', {
        input: { ports: context.ports, vault_id, generation, path: '' },
        id: `load-root-${String(Date.now())}`
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
    get_vault_id: input.get_vault_id,
    get_vault_generation: input.get_vault_generation,
    dispatch_many: input.dispatch_many
  }),
  states: {
    active: {
      on: {
        VAULT_CHANGED: {
          actions: ['stop_active_loads', 'reset_state', 'load_root_folder']
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
          actions: ['stop_active_loads', 'reset_state']
        }
      }
    }
  }
})
