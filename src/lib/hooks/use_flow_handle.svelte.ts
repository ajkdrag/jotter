import { onDestroy } from 'svelte'
import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'

export function use_flow_handle<TEvent, TContext>(
  handle: FlowHandle<TEvent, FlowSnapshot<TContext>>
): {
  snapshot: FlowSnapshot<TContext>
  send: (event: TEvent) => void
} {
  let snapshot = $state(handle.get_snapshot())
  const unsubscribe = handle.subscribe((next) => {
    snapshot = next
  })

  onDestroy(() => {
    unsubscribe()
    handle.stop()
  })

  return {
    get snapshot() {
      return snapshot
    },
    send: handle.send
  }
}

