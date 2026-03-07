import type { WindowInit } from "$lib/features/window/domain/window_types";

export interface WindowPort {
  open_window(init: WindowInit): Promise<void>;
}
