import { SvelteMap } from "svelte/reactivity";

type OpStatus = "idle" | "pending" | "success" | "error";

type OpState = {
  status: OpStatus;
  error: string | null;
  started_at: number | null;
};

const IDLE: OpState = {
  status: "idle",
  error: null,
  started_at: null,
};

export class OpStore {
  ops = $state<SvelteMap<string, OpState>>(new SvelteMap<string, OpState>());

  get(key: string): OpState {
    return this.ops.get(key) ?? IDLE;
  }

  is_pending(key: string): boolean {
    return this.get(key).status === "pending";
  }

  start(key: string) {
    this.ops.set(key, {
      status: "pending",
      error: null,
      started_at: Date.now(),
    });
  }

  succeed(key: string) {
    this.ops.set(key, { status: "success", error: null, started_at: null });
  }

  fail(key: string, error: string) {
    this.ops.set(key, { status: "error", error, started_at: null });
  }

  reset(key: string) {
    this.ops.delete(key);
  }

  reset_all() {
    this.ops = new SvelteMap<string, OpState>();
  }
}
