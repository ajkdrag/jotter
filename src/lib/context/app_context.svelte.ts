import { getContext, setContext } from "svelte";
import type { AppContext } from "$lib/di/create_app_context";

const APP_CONTEXT_KEY = Symbol("app-context");

export function provide_app_context(value: AppContext): void {
  setContext(APP_CONTEXT_KEY, value);
}

export function use_app_context(): AppContext {
  const value = getContext<AppContext | undefined>(APP_CONTEXT_KEY);
  if (!value) {
    throw new Error("app context is not available");
  }
  return value;
}
