import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { EditorSettings } from "$lib/types/editor_settings";

async function apply_opened_vault(
  input: ActionRegistrationInput,
  editor_settings: EditorSettings,
) {
  input.stores.ui.reset_for_new_vault();
  input.stores.ui.set_editor_settings(editor_settings);
  input.stores.ui.change_vault = {
    open: false,
    is_loading: false,
    error: null,
  };
  await input.registry.execute(ACTION_IDS.folder_refresh_tree);
}

export function register_vault_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  registry.register({
    id: ACTION_IDS.vault_request_change,
    label: "Request Change Vault",
    execute: () => {
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        open: true,
        error: null,
      };
    },
  });

  registry.register({
    id: ACTION_IDS.vault_close_change,
    label: "Close Change Vault Dialog",
    execute: () => {
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        open: false,
        error: null,
      };
      stores.op.reset("vault.change");
    },
  });

  registry.register({
    id: ACTION_IDS.vault_choose,
    label: "Choose Vault",
    execute: async () => {
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: true,
        error: null,
      };

      stores.ui.set_system_dialog_open(true);
      const path_result = await services.vault.choose_vault_path();
      stores.ui.set_system_dialog_open(false);

      if (path_result.status === "cancelled") {
        stores.ui.change_vault = {
          ...stores.ui.change_vault,
          is_loading: false,
        };
        stores.op.reset("vault.change");
        return;
      }

      if (path_result.status === "failed") {
        stores.ui.change_vault = {
          ...stores.ui.change_vault,
          is_loading: false,
          error: path_result.error,
        };
        stores.op.fail("vault.change", path_result.error);
        return;
      }

      const result = await services.vault.change_vault_by_path(
        path_result.path,
      );
      if (result.status === "opened") {
        await apply_opened_vault(input, result.editor_settings);
        return;
      }

      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: false,
        error: result.error,
      };
    },
  });

  registry.register({
    id: ACTION_IDS.vault_select,
    label: "Select Vault",
    execute: async (vault_id: unknown) => {
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: true,
        error: null,
      };

      const selected_vault_id = vault_id as Parameters<
        typeof services.vault.change_vault_by_id
      >[0];
      const result = await services.vault.change_vault_by_id(selected_vault_id);
      if (result.status === "opened") {
        await apply_opened_vault(input, result.editor_settings);
        return;
      }

      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: false,
        error: result.error,
      };
    },
  });
}
