import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";

export function register_ui_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  function parse_sidebar_view(
    input_view: unknown,
  ): "explorer" | "dashboard" | "starred" {
    const value = String(input_view);
    if (value === "starred") return "starred";
    if (value === "dashboard") return "dashboard";
    return "explorer";
  }

  registry.register({
    id: ACTION_IDS.shell_open_url,
    label: "Open External URL",
    execute: (url: unknown) => {
      if (typeof url === "string") {
        void services.shell.open_url(url);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.ui_toggle_sidebar,
    label: "Toggle Sidebar",
    shortcut: "CmdOrCtrl+B",
    execute: () => {
      stores.ui.toggle_sidebar();
    },
  });

  registry.register({
    id: ACTION_IDS.ui_select_folder,
    label: "Select Folder",
    execute: (path: unknown) => {
      stores.ui.set_selected_folder_path(String(path));
    },
  });

  registry.register({
    id: ACTION_IDS.ui_set_sidebar_view,
    label: "Set Sidebar View",
    execute: (view: unknown) => {
      stores.ui.set_sidebar_view(parse_sidebar_view(view));
    },
  });

  registry.register({
    id: ACTION_IDS.ui_toggle_context_rail,
    label: "Toggle Links Panel",
    shortcut: "CmdOrCtrl+Shift+L",
    execute: () => {
      stores.ui.toggle_context_rail();
    },
  });

  registry.register({
    id: ACTION_IDS.ui_open_vault_dashboard,
    label: "Open Vault Dashboard",
    shortcut: "CmdOrCtrl+Shift+D",
    execute: () => {
      stores.ui.vault_dashboard = { open: true };
    },
  });

  registry.register({
    id: ACTION_IDS.ui_close_vault_dashboard,
    label: "Close Vault Dashboard",
    execute: () => {
      stores.ui.vault_dashboard = { open: false };
    },
  });
}
