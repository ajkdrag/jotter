import { onDestroy } from 'svelte'
import type { StoreHandle } from '$lib/stores/store_handle'

export function use_store_handle<TState, TEvent>(
  handle: StoreHandle<TState, TEvent>
): {
  state: TState
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
  }
}
