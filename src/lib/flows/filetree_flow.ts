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
    .then((contents) => {
      sendBack({ type: 'FOLDER_LOAD_DONE', path, contents })
    })
    .catch((error) => {
      sendBack({ type: 'FOLDER_LOAD_ERROR', path, error: String(error) })
    })
  return () => {}
})

export const filetree_flow_machine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvents,
    input: {} as FlowInput
  },
  actors: {
    load_folder: load_folder_actor
  },
  actions: {
    start_load: assign(({ context, event, spawn }) => {
      if (event.type !== 'REQUEST_LOAD' && event.type !== 'RETRY_LOAD' && event.type !== 'TOGGLE_FOLDER' && event.type !== 'EXPAND_FOLDER') {
        return context
      }
      const path = event.path
      const vault_id = context.get_vault_id()
      if (!vault_id) return context

      const current_state = context.load_states.get(path)
      if (current_state === 'loading' || current_state === 'loaded') {
        if (event.type !== 'RETRY_LOAD') return context
      }

      const new_load_states = new Map(context.load_states)
      new_load_states.set(path, 'loading')

      const new_active_loads = new Map(context.active_loads)
      const existing = new_active_loads.get(path)
      if (existing) existing.stop?.()

      const actor_id = `load-${path}-${Date.now()}`
      const actor = spawn('load_folder', {
        input: { ports: context.ports, vault_id, path },
        id: actor_id
      })
      new_active_loads.set(path, actor)

      return {
        ...context,
        load_states: new_load_states,
        active_loads: new_active_loads
      }
    }),
    handle_load_done: assign(({ context, event }) => {
      if (event.type !== 'FOLDER_LOAD_DONE') return context

      const { path, contents } = event
      const new_load_states = new Map(context.load_states)
      const new_error_messages = new Map(context.error_messages)
      const new_active_loads = new Map(context.active_loads)

      new_load_states.set(path, 'loaded')
      new_error_messages.delete(path)
      new_active_loads.delete(path)

      context.dispatch({ type: 'MERGE_FOLDER_CONTENTS', folder_path: path, contents })

      return {
        ...context,
        load_states: new_load_states,
        error_messages: new_error_messages,
        active_loads: new_active_loads
      }
    }),
    handle_load_error: assign(({ context, event }) => {
      if (event.type !== 'FOLDER_LOAD_ERROR') return context

      const { path, error } = event
      const new_load_states = new Map(context.load_states)
      const new_error_messages = new Map(context.error_messages)
      const new_active_loads = new Map(context.active_loads)

      new_load_states.set(path, 'error')
      new_error_messages.set(path, error)
      new_active_loads.delete(path)

      return {
        ...context,
        load_states: new_load_states,
        error_messages: new_error_messages,
        active_loads: new_active_loads
      }
    })
  }
}).createMachine({
  id: 'filetree_flow',
  initial: 'active',
  context: ({ input }) => ({
    expanded_paths: new Set<string>(),
    load_states: new Map<string, FolderLoadState>(),
    error_messages: new Map<string, string>(),
    active_loads: new Map(),
    ports: input.ports,
    dispatch: input.dispatch,
    get_vault_id: input.get_vault_id
  }),
  states: {
    active: {
      on: {
        VAULT_CHANGED: {
          actions: [
            assign(({ context }) => ({
              ...context,
              expanded_paths: new Set<string>(),
              load_states: new Map<string, FolderLoadState>(),
              error_messages: new Map<string, string>(),
              active_loads: new Map()
            })),
            assign(({ context, spawn }) => {
              const vault_id = context.get_vault_id()
              if (!vault_id) return context

              const new_load_states = new Map<string, FolderLoadState>()
              new_load_states.set('', 'loading')

              const new_active_loads = new Map()
              const actor = spawn('load_folder', {
                input: { ports: context.ports, vault_id, path: '' },
                id: `load-root-${Date.now()}`
              })
              new_active_loads.set('', actor)

              return {
                ...context,
                load_states: new_load_states,
                active_loads: new_active_loads
              }
            })
          ]
        },
        TOGGLE_FOLDER: {
          actions: [
            assign(({ context, event }) => {
              const new_expanded = new Set(context.expanded_paths)
              if (new_expanded.has(event.path)) {
                new_expanded.delete(event.path)
                return { ...context, expanded_paths: new_expanded }
              } else {
                new_expanded.add(event.path)
                return { ...context, expanded_paths: new_expanded }
              }
            }),
            assign(({ context, event, spawn }) => {
              if (context.expanded_paths.has(event.path)) {
                const current_state = context.load_states.get(event.path)
                if (!current_state || current_state === 'unloaded' || current_state === 'error') {
                  const vault_id = context.get_vault_id()
                  if (!vault_id) return context

                  const new_load_states = new Map(context.load_states)
                  new_load_states.set(event.path, 'loading')

                  const new_active_loads = new Map(context.active_loads)
                  const actor = spawn('load_folder', {
                    input: { ports: context.ports, vault_id, path: event.path },
                    id: `load-${event.path}`,
                    systemId: `load-${event.path}`
                  })
                  new_active_loads.set(event.path, actor)

                  return {
                    ...context,
                    load_states: new_load_states,
                    active_loads: new_active_loads
                  }
                }
              }
              return context
            })
          ]
        },
        EXPAND_FOLDER: {
          actions: [
            assign(({ context, event }) => {
              const new_expanded = new Set(context.expanded_paths)
              new_expanded.add(event.path)
              return { ...context, expanded_paths: new_expanded }
            }),
            'start_load'
          ]
        },
        COLLAPSE_FOLDER: {
          actions: assign(({ context, event }) => {
            const new_expanded = new Set(context.expanded_paths)
            new_expanded.delete(event.path)
            return { ...context, expanded_paths: new_expanded }
          })
        },
        REQUEST_LOAD: {
          actions: 'start_load'
        },
        FOLDER_LOAD_DONE: {
          actions: 'handle_load_done'
        },
        FOLDER_LOAD_ERROR: {
          actions: 'handle_load_error'
        },
        RETRY_LOAD: {
          actions: 'start_load'
        },
        COLLAPSE_ALL: {
          actions: assign(({ context }) => ({
            ...context,
            expanded_paths: new Set<string>()
          }))
        },
        RESET: {
          actions: assign(({ context }) => ({
            ...context,
            expanded_paths: new Set<string>(),
            load_states: new Map<string, FolderLoadState>(),
            error_messages: new Map<string, string>(),
            active_loads: new Map()
          }))
        }
      }
    }
  }
})
