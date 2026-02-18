import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { OpenNoteState } from "$lib/types/editor";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/types/editor_settings";
import { DEFAULT_HOTKEYS } from "$lib/domain/default_hotkeys";
import { is_tauri } from "$lib/utils/detect_platform";
import { toast } from "svelte-sonner";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("app_actions");

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
    execute: async (root: unknown, note: unknown) => {
      await services.editor.mount({
        root: root as HTMLDivElement,
        note: note as OpenNoteState,
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

  registry.register({
    id: ACTION_IDS.app_check_for_updates,
    label: "Check for Updates",
    execute: async () => {
      if (!is_tauri) {
        toast.info("Updates are only available in the desktop app");
        return;
      }
      const { check } = await import("@tauri-apps/plugin-updater");
      const toastId = toast.loading("Checking for updates...");
      try {
        const update = await check();
        toast.dismiss(toastId);
        if (!update) {
          toast.success("Jotter is up to date");
          return;
        }
        toast.loading(`Downloading update v${update.version}...`, {
          id: toastId,
        });
        await update.downloadAndInstall();
        toast.dismiss(toastId);
        toast.success("Update installed — restart Jotter to apply");
      } catch (error) {
        toast.dismiss(toastId);
        toast.error("Failed to check for updates");
        log.error("Update check failed", { error: String(error) });
      }
    },
  });
}
