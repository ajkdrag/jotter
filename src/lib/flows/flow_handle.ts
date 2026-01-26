export type FlowUnsubscribe = () => void

export type FlowSnapshot<TContext> = {
  context: TContext
  matches: (state: string) => boolean
}

export type FlowHandle<TEvent, TSnapshot extends FlowSnapshot<unknown>> = {
  send: (event: TEvent) => void
  get_snapshot: () => TSnapshot
  subscribe: (listener: (snapshot: TSnapshot) => void) => FlowUnsubscribe
  stop: () => void
}

