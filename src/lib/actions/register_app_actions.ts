import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { EditorSettings } from "$lib/types/editor_settings";
import type { OpenNoteState } from "$lib/types/editor";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/types/editor_settings";
import { DEFAULT_HOTKEYS } from "$lib/domain/default_hotkeys";

export function register_app_actions(input: ActionRegistrationInput) {
  const { registry, stores, services, default_mount_config } = input;

  registry.register({
    id: ACTION_IDS.app_mounted,
    label: "App Mounted",
    execute: async () => {
      stores.ui.startup = {
        status: "loading",
        error: null,
      };

      const [result, recent_command_ids, hotkey_overrides] = await Promise.all([
        services.vault.initialize(default_mount_config),
        services.settings.load_recent_command_ids(),
        services.hotkey.load_hotkey_overrides(),
      ]);
      stores.ui.set_theme(result.theme);
      stores.ui.set_recent_command_ids(recent_command_ids);

      stores.ui.hotkey_overrides = hotkey_overrides;
      const hotkeys_config = services.hotkey.merge_config(
        DEFAULT_HOTKEYS,
        hotkey_overrides,
      );
      stores.ui.set_hotkeys_config(hotkeys_config);

      if (result.status === "error") {
        stores.ui.startup = {
          status: "error",
          error: result.error,
        };
        return;
      }

      if (default_mount_config.reset_app_state) {
        stores.ui.reset_for_new_vault();
        stores.ui.set_editor_settings({ ...DEFAULT_EDITOR_SETTINGS });
      }

      if (result.has_vault) {
        stores.ui.reset_for_new_vault();
        stores.ui.set_editor_settings(
          result.editor_settings ?? { ...DEFAULT_EDITOR_SETTINGS },
        );
        await registry.execute(ACTION_IDS.folder_refresh_tree);
        await registry.execute(ACTION_IDS.git_check_repo);
        if (stores.ui.editor_settings.show_vault_dashboard_on_open) {
          await registry.execute(ACTION_IDS.ui_open_vault_dashboard);
        }
      }

      stores.ui.startup = {
        status: "idle",
        error: null,
      };
    },
  });

  registry.register({
    id: ACTION_IDS.app_editor_mount,
    label: "Editor Mount",
    execute: async (root: unknown, note: unknown, link_syntax: unknown) => {
      await services.editor.mount({
        root: root as HTMLDivElement,
        note: note as OpenNoteState,
        link_syntax: link_syntax as EditorSettings["link_syntax"],
      });
    },
  });

  registry.register({
    id: ACTION_IDS.app_editor_unmount,
    label: "Editor Unmount",
    execute: () => {
      services.editor.unmount();
    },
  });
}
