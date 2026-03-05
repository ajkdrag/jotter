import { listen } from "@tauri-apps/api/event";
import { is_tauri } from "$lib/shared/utils/detect_platform";
import { create_logger } from "$lib/shared/utils/logger";

const log = create_logger("file_open_reactor");

export function create_file_open_reactor(
  on_file_open: (file_path: string) => void,
): () => void {
  if (!is_tauri) {
    return () => {};
  }

  let unlisten: (() => void) | null = null;
  let cancelled = false;

  void listen<string>("file-open", (event) => {
    if (cancelled) return;
    log.info("Received file-open event", { file_path: event.payload });
    on_file_open(event.payload);
  }).then((fn) => {
    if (cancelled) {
      fn();
    } else {
      unlisten = fn;
    }
  });

  return () => {
    cancelled = true;
    unlisten?.();
    unlisten = null;
  };
}
