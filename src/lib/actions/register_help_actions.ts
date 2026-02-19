import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";

export function register_help_actions(input: ActionRegistrationInput) {
  const { registry, stores } = input;

  registry.register({
    id: ACTION_IDS.help_open,
    label: "Open Help",
    execute: () => {
      stores.ui.help_dialog = { open: true };
    },
  });

  registry.register({
    id: ACTION_IDS.help_close,
    label: "Close Help",
    execute: () => {
      stores.ui.help_dialog = { open: false };
    },
  });
}
