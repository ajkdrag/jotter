export type {
  WindowKind,
  WindowInit,
} from "$lib/features/window/domain/window_types";
export {
  parse_window_init,
  compute_title,
} from "$lib/features/window/domain/window_types";
export type { WindowPort } from "$lib/features/window/ports";
export { create_window_tauri_adapter } from "$lib/features/window/adapters/window_tauri_adapter";
export { register_window_actions } from "$lib/features/window/application/window_actions";
