import type { ClipboardPort } from "$lib/ports/clipboard_port";

export function create_clipboard_tauri_adapter(): ClipboardPort {
  return {
    async write_text(text) {
      await navigator.clipboard.writeText(text);
    },
  };
}
