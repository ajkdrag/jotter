import { SvelteMap } from 'svelte/reactivity'

export type OpStatus = 'idle' | 'pending' | 'success' | 'error'

export type OpState = {
  status: OpStatus
  error: string | null
  started_at: number | null
}

const IDLE: OpState = {
  status: 'idle',
  error: null,
  started_at: null
}

export class OpStore {
  ops = $state<SvelteMap<string, OpState>>(new SvelteMap<string, OpState>())

  get(key: string): OpState {
    return this.ops.get(key) ?? IDLE
  }

  is_pending(key: string): boolean {
    return this.get(key).status === 'pending'
  }

  start(key: string) {
    const next = new SvelteMap(this.ops)
    next.set(key, {
      status: 'pending',
      error: null,
      started_at: Date.now()
    })
    this.ops = next
  }

  succeed(key: string) {
    const next = new SvelteMap(this.ops)
    next.set(key, {
      status: 'success',
      error: null,
      started_at: null
    })
    this.ops = next
  }

  fail(key: string, error: string) {
    const next = new SvelteMap(this.ops)
    next.set(key, {
      status: 'error',
      error,
      started_at: null
    })
    this.ops = next
  }

  reset(key: string) {
    const next = new SvelteMap(this.ops)
    next.delete(key)
    this.ops = next
  }

  reset_all() {
    this.ops = new SvelteMap<string, OpState>()
  }
}
