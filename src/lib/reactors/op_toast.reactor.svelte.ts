import { toast } from "svelte-sonner";
import type { OpStore } from "$lib/app";
import { create_logger } from "$lib/shared/utils/logger";

const log = create_logger("op_toast_reactor");

type ToastCommand =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; log_label: string; error: string };

export function resolve_op_toast_commands(input: {
  key: string;
  previous_status: string;
  current_status: string;
  error: string | null;
  message: string | null;
}): ToastCommand[] {
  const { key, previous_status, current_status, error, message } = input;
  if (current_status === previous_status) {
    return [];
  }

  if (key === "clipboard.write") {
    if (current_status === "success") {
      return [{ kind: "success", message: "Copied to clipboard" }];
    }
    if (current_status === "error") {
      return [
        {
          kind: "error",
          message: "Failed to copy to clipboard",
          log_label: "Clipboard write failed",
          error: error ?? "unknown error",
        },
      ];
    }
  }

  if (key === "links.repair") {
    if (current_status === "success") {
      return [
        {
          kind: "success",
          message: message ?? "Link repair complete",
        },
      ];
    }
    if (current_status === "error") {
      return [
        {
          kind: "error",
          message: "Some links could not be repaired",
          log_label: "Link repair failed",
          error: error ?? "unknown error",
        },
      ];
    }
  }

  return [];
}

export function create_op_toast_reactor(op_store: OpStore): () => void {
  let last_clipboard_status = op_store.get("clipboard.write").status;
  let last_link_repair_status = op_store.get("links.repair").status;

  const apply_commands = (commands: ToastCommand[]) => {
    for (const command of commands) {
      if (command.kind === "success") {
        toast.success(command.message);
        continue;
      }

      log.error(command.log_label, { error: command.error });
      toast.error(command.message);
    }
  };

  return $effect.root(() => {
    $effect(() => {
      const clipboard = op_store.get("clipboard.write");
      const clipboard_commands = resolve_op_toast_commands({
        key: "clipboard.write",
        previous_status: last_clipboard_status,
        current_status: clipboard.status,
        error: clipboard.error,
        message: clipboard.message,
      });
      last_clipboard_status = clipboard.status;
      apply_commands(clipboard_commands);

      const link_repair = op_store.get("links.repair");
      const link_repair_commands = resolve_op_toast_commands({
        key: "links.repair",
        previous_status: last_link_repair_status,
        current_status: link_repair.status,
        error: link_repair.error,
        message: link_repair.message,
      });
      last_link_repair_status = link_repair.status;
      apply_commands(link_repair_commands);
    });
  });
}
