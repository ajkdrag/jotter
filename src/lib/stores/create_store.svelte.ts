import { SvelteSet } from 'svelte/reactivity'
import type { StoreHandle } from './store_handle'

export function create_store<TState extends object, TEvent>(
  initial_state: TState,
  reduce: (state: TState, event: TEvent) => TState
): StoreHandle<TState, TEvent> {
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
    reduce: (event) => {
      const next = reduce(get(), event)
      if (next === state) return
      set(next)
    }
  }
}
