import type { AppEvent } from '$lib/events/app_event'
import type { AppStores } from '$lib/stores/create_app_stores'

export type EventSubscriber = (event: AppEvent) => void

export type EventBus = {
  dispatch: (event: AppEvent) => void
  dispatch_many: (events: AppEvent[]) => void
  subscribe: (listener: EventSubscriber) => () => void
}

export function create_event_bus(stores: AppStores): EventBus {
  const listeners = new Set<EventSubscriber>()

  const dispatch = (event: AppEvent) => {
    stores.dispatch(event)
    listeners.forEach((listener) => { listener(event) })
  }

  const dispatch_many = (events: AppEvent[]) => {
    for (const event of events) {
      dispatch(event)
    }
  }

  const subscribe = (listener: EventSubscriber) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  return { dispatch, dispatch_many, subscribe }
}
