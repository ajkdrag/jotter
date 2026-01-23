import { onDestroy } from 'svelte'
import { createActor } from 'xstate'
import type { Actor, ActorOptions, AnyActorLogic, SnapshotFrom } from 'xstate'

export function use_xstate_machine<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: ActorOptions<TLogic>
): {
  actor: Actor<TLogic>
  snapshot: SnapshotFrom<TLogic>
} {
  const actor = createActor(logic, options)
  actor.start()

  let snapshot = $state(actor.getSnapshot())
  const subscription = actor.subscribe((next) => {
    snapshot = next
  })

  onDestroy(() => {
    subscription.unsubscribe()
    actor.stop()
  })

  return {
    actor,
    get snapshot() {
      return snapshot
    }
  }
}
