import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { TerminalStore } from "$lib/features/terminal/state/terminal_store.svelte";

export function register_terminal_actions(
  input: ActionRegistrationInput & {
    terminal_store: TerminalStore;
  },
) {
  const { registry, terminal_store } = input;

  registry.register({
    id: ACTION_IDS.terminal_toggle,
    label: "Toggle Terminal",
    execute: () => {
      terminal_store.toggle();
    },
  });

  registry.register({
    id: ACTION_IDS.terminal_close,
    label: "Close Terminal",
    execute: () => {
      terminal_store.close();
    },
  });
}
