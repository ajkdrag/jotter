import { createActor } from 'xstate'
import type { ActorOptions, AnyStateMachine, ContextFrom, EventFromLogic } from 'xstate'
import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'

export function create_flow_handle<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options: ActorOptions<TMachine>
): FlowHandle<EventFromLogic<TMachine>, FlowSnapshot<ContextFrom<TMachine>>> {
  const actor = createActor(machine, options)

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    actor.stop()
  }

  actor.start()

  function wrap(snapshot: ReturnType<typeof actor.getSnapshot>): FlowSnapshot<ContextFrom<TMachine>> {
    interface SnapshotWithContextAndMatches {
      context: ContextFrom<TMachine>
      matches: (state: string) => boolean
    }
    const snapshotWithMethods = snapshot as SnapshotWithContextAndMatches
    return {
      context: snapshotWithMethods.context,
      matches: snapshotWithMethods.matches
    }
  }

  return {
    send: (event) => actor.send(event),
    get_snapshot: () => wrap(actor.getSnapshot()),
    subscribe: (listener) => {
      const sub = actor.subscribe((next) => listener(wrap(next)))
      return () => sub.unsubscribe()
    },
    stop
  }
}
