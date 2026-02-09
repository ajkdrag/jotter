import type { ClipboardPort } from "$lib/ports/clipboard_port";
import { create_clipboard_web_adapter } from "$lib/adapters/web/clipboard_web_adapter";

export function create_clipboard_tauri_adapter(): ClipboardPort {
  return create_clipboard_web_adapter();
}
