import { onDestroy } from 'svelte'
import type { StoreHandle } from '$lib/stores/store_handle'

export function use_store_handle<TState, TActions>(
  handle: StoreHandle<TState, TActions>
): {
  state: TState
  actions: TActions
} {
  let state = $state(handle.get_snapshot())
  const unsubscribe = handle.subscribe((next) => {
    state = next
  })

  onDestroy(() => {
    unsubscribe()
  })

  return {
    get state() {
      return state
    },
    actions: handle.actions
  }
}
