export type StoreUnsubscribe = () => void

export type StoreHandle<TState, TActions> = {
  get_snapshot: () => TState
  subscribe: (listener: (state: TState) => void) => StoreUnsubscribe
  actions: TActions
}
