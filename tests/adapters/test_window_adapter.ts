import type { WindowPort } from "$lib/features/window";

export function create_test_window_adapter(): WindowPort {
  return {
    open_window: () => Promise.resolve(),
  };
}
