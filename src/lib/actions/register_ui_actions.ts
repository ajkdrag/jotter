import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { ThemeMode } from "$lib/types/theme";

export function register_ui_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

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
    id: ACTION_IDS.ui_set_theme,
    label: "Set Theme",
    execute: (theme: unknown) => {
      const next_theme = theme as ThemeMode;
      const result = services.vault.set_theme(next_theme);
      if (result.status === "success") {
        stores.ui.set_theme(next_theme);
      }
    },
  });
}
