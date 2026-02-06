export type StoreUnsubscribe = () => void

export type StoreHandle<TState, TEvent> = {
  get_snapshot: () => TState
  subscribe: (listener: (state: TState) => void) => StoreUnsubscribe
  reduce: (event: TEvent) => void
}
