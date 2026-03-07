import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { WindowPort } from "$lib/features/window/ports";
import type { WindowInit } from "$lib/features/window/domain/window_types";
import { compute_title } from "$lib/features/window/domain/window_types";

function build_url(init: WindowInit): string {
  const params = new URLSearchParams();
  params.set("window_kind", init.kind);
  if (init.kind === "browse" || init.kind === "viewer") {
    params.set("vault_path", init.vault_path);
  }
  if (init.kind === "viewer") {
    params.set("file_path", init.file_path);
  }
  return `/?${params.toString()}`;
}

function window_size(init: WindowInit): { width: number; height: number } {
  if (init.kind === "viewer") return { width: 900, height: 700 };
  return { width: 1000, height: 700 };
}

export function create_window_tauri_adapter(): WindowPort {
  return {
    async open_window(init: WindowInit): Promise<void> {
      const label = `${init.kind}-${String(Date.now())}`;
      const { width, height } = window_size(init);
      const webview = new WebviewWindow(label, {
        url: build_url(init),
        title: compute_title(init),
        width,
        height,
      });
      await webview.once("tauri://created", () => {});
    },
  };
}
