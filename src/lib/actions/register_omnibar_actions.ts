import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { OmnibarItem } from "$lib/types/search";
import type { CommandId } from "$lib/types/command_palette";

function open_omnibar(input: ActionRegistrationInput) {
  input.stores.ui.omnibar = {
    ...input.stores.ui.omnibar,
    open: true,
    query: "",
    selected_index: 0,
    is_searching: false,
  };
  input.stores.search.clear_omnibar();
}

function close_omnibar(input: ActionRegistrationInput) {
  input.stores.ui.omnibar = {
    ...input.stores.ui.omnibar,
    open: false,
    query: "",
    selected_index: 0,
    is_searching: false,
  };
  input.stores.search.clear_omnibar();
  input.stores.op.reset("search.notes");
}

async function execute_command(
  input: ActionRegistrationInput,
  command_id: CommandId,
) {
  const { registry } = input;

  switch (command_id) {
    case "create_new_note":
      await registry.execute(ACTION_IDS.note_create);
      break;
    case "change_vault":
      await registry.execute(ACTION_IDS.vault_request_change);
      break;
    case "open_settings":
      await registry.execute(ACTION_IDS.settings_open);
      break;
  }
}

async function confirm_item(input: ActionRegistrationInput, item: OmnibarItem) {
  const { registry } = input;

  switch (item.kind) {
    case "note":
    case "recent_note":
      close_omnibar(input);
      await registry.execute(ACTION_IDS.note_open, item.note.id);
      break;
    case "command":
      close_omnibar(input);
      await execute_command(input, item.command.id);
      break;
    case "setting":
      close_omnibar(input);
      await registry.execute(ACTION_IDS.settings_open);
      break;
  }
}

export function register_omnibar_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  registry.register({
    id: ACTION_IDS.omnibar_toggle,
    label: "Toggle Omnibar",
    execute: () => {
      if (stores.ui.omnibar.open) {
        close_omnibar(input);
        return;
      }
      open_omnibar(input);
    },
  });

  registry.register({
    id: ACTION_IDS.omnibar_open,
    label: "Open Omnibar",
    execute: () => {
      open_omnibar(input);
    },
  });

  registry.register({
    id: ACTION_IDS.omnibar_close,
    label: "Close Omnibar",
    execute: () => {
      close_omnibar(input);
    },
  });

  registry.register({
    id: ACTION_IDS.omnibar_set_query,
    label: "Set Omnibar Query",
    execute: async (query: unknown) => {
      const normalized_query = String(query);

      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        query: normalized_query,
        selected_index: 0,
      };

      if (!normalized_query.trim()) {
        stores.ui.omnibar = { ...stores.ui.omnibar, is_searching: false };
        stores.search.clear_omnibar();
        stores.op.reset("search.notes");
        return;
      }

      stores.ui.omnibar = { ...stores.ui.omnibar, is_searching: true };
      const result = await services.search.search_omnibar(normalized_query);
      if (stores.ui.omnibar.query !== normalized_query) return;
      stores.search.set_omnibar_items(result.items);
      stores.ui.omnibar = { ...stores.ui.omnibar, is_searching: false };
    },
  });

  registry.register({
    id: ACTION_IDS.omnibar_set_selected_index,
    label: "Set Omnibar Selected Index",
    execute: (index: unknown) => {
      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        selected_index: Number(index),
      };
    },
  });

  registry.register({
    id: ACTION_IDS.omnibar_confirm_item,
    label: "Confirm Omnibar Item",
    execute: async (arg: unknown) => {
      const item = arg as OmnibarItem | undefined;
      if (!item) return;
      await confirm_item(input, item);
    },
  });
}
