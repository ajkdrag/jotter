import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { EditorSettings } from "$lib/types/editor_settings";
import type { VaultId } from "$lib/types/ids";
import { toast } from "svelte-sonner";

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
  let change_vault_request_revision = 0;

  const handle_open_result = async (
    request_revision: number,
    result:
      | Awaited<ReturnType<typeof services.vault.change_vault_by_id>>
      | Awaited<ReturnType<typeof services.vault.select_pinned_vault_by_slot>>,
  ) => {
    if (request_revision !== change_vault_request_revision) {
      return;
    }
    if (result.status === "opened") {
      await apply_opened_vault(input, result.editor_settings);
      return;
    }
    if (result.status === "stale") {
      return;
    }
    if (result.status === "skipped") {
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: false,
        error: null,
      };
      services.vault.reset_change_operation();
      return;
    }

    stores.ui.change_vault = {
      ...stores.ui.change_vault,
      is_loading: false,
      error: result.error,
    };
  };

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
      services.vault.reset_change_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.vault_choose,
    label: "Choose Vault",
    execute: async () => {
      const request_revision = ++change_vault_request_revision;
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: true,
        error: null,
      };

      stores.ui.set_system_dialog_open(true);
      const path_result = await services.vault.choose_vault_path();
      stores.ui.set_system_dialog_open(false);

      if (request_revision !== change_vault_request_revision) {
        return;
      }

      if (path_result.status === "cancelled") {
        stores.ui.change_vault = {
          ...stores.ui.change_vault,
          is_loading: false,
        };
        services.vault.reset_change_operation();
        return;
      }

      if (path_result.status === "failed") {
        stores.ui.change_vault = {
          ...stores.ui.change_vault,
          is_loading: false,
          error: path_result.error,
        };
        return;
      }

      const result = await services.vault.change_vault_by_path(
        path_result.path,
      );
      await handle_open_result(request_revision, result);
    },
  });

  registry.register({
    id: ACTION_IDS.vault_select,
    label: "Select Vault",
    execute: async (vault_id: unknown) => {
      const request_revision = ++change_vault_request_revision;
      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: true,
        error: null,
      };

      const selected_vault_id = vault_id as Parameters<
        typeof services.vault.change_vault_by_id
      >[0];
      const result = await services.vault.change_vault_by_id(selected_vault_id);
      await handle_open_result(request_revision, result);
    },
  });

  registry.register({
    id: ACTION_IDS.vault_select_pinned_slot,
    label: "Select Pinned Vault Slot",
    execute: async (slot: unknown) => {
      if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0) {
        return;
      }

      stores.ui.change_vault = {
        ...stores.ui.change_vault,
        is_loading: true,
        error: null,
      };

      const request_revision = ++change_vault_request_revision;
      const result = await services.vault.select_pinned_vault_by_slot(slot);
      await handle_open_result(request_revision, result);
    },
  });

  registry.register({
    id: ACTION_IDS.vault_toggle_pin,
    label: "Toggle Vault Pin",
    execute: async (vault_id: unknown) => {
      if (typeof vault_id !== "string") {
        return;
      }
      const result = await services.vault.toggle_vault_pin(vault_id as VaultId);
      if (result.status === "failed") {
        toast.error(result.error);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.vault_reindex,
    label: "Reindex Vault",
    when: () => stores.vault.vault !== null,
    execute: async () => {
      const result = await services.vault.rebuild_index();
      if (result.status === "failed") {
        toast.error(result.error);
      }
    },
  });
}
