import type { ShellPort } from "$lib/ports/shell_port";
import { openUrl } from "@tauri-apps/plugin-opener";

export function create_shell_tauri_adapter(): ShellPort {
  return {
    async open_url(url) {
      await openUrl(url);
    },
  };
}
