import { SvelteSet } from 'svelte/reactivity'
import type { StoreHandle } from './store_handle'

export function create_store<TState extends object, TActions>(
  initial_state: TState,
  create_actions: (get: () => TState, set: (s: TState) => void) => TActions
): StoreHandle<TState, TActions> {
  let state = $state(initial_state)
  const listeners = new SvelteSet<(s: TState) => void>()

  const get = (): TState => state
  const set = (next: TState): void => {
    state = next
    listeners.forEach(fn => { fn(state); })
  }

  return {
    get_snapshot: get,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    actions: create_actions(get, set)
  }
}
