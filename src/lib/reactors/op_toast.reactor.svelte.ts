import { toast } from "svelte-sonner";
import type { OpStore } from "$lib/stores/op_store.svelte";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("op_toast_reactor");

export function create_op_toast_reactor(op_store: OpStore): () => void {
  let last_clipboard_status = op_store.get("clipboard.write").status;

  return $effect.root(() => {
    $effect(() => {
      const clipboard = op_store.get("clipboard.write");

      if (clipboard.status !== last_clipboard_status) {
        last_clipboard_status = clipboard.status;

        if (clipboard.status === "success") {
          toast.success("Copied to clipboard");
        }

        if (clipboard.status === "error") {
          log.error("Clipboard write failed", {
            error: clipboard.error ?? "unknown error",
          });
          toast.error("Failed to copy to clipboard");
        }
      }
    });
  });
}
