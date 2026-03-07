import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { WindowPort } from "$lib/features/window/ports";

export function register_window_actions(
  input: ActionRegistrationInput & {
    window_port: WindowPort;
  },
) {
  const { registry, window_port } = input;

  registry.register({
    id: ACTION_IDS.window_open_viewer,
    label: "Open Viewer Window",
    execute: async (...args: unknown[]) => {
      const { vault_path, file_path } = args[0] as {
        vault_path: string;
        file_path: string;
      };
      await window_port.open_window({ kind: "viewer", vault_path, file_path });
    },
  });

  registry.register({
    id: ACTION_IDS.window_open_browse,
    label: "Open Browse Window",
    execute: async (...args: unknown[]) => {
      const { vault_path } = args[0] as { vault_path: string };
      await window_port.open_window({ kind: "browse", vault_path });
    },
  });
}
