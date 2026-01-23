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

  function wrap(snapshot: any): FlowSnapshot<ContextFrom<TMachine>> {
    return {
      context: snapshot.context as ContextFrom<TMachine>,
      matches: (state: string) => snapshot.matches(state)
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
