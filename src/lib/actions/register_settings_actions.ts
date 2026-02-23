import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import { DEFAULT_HOTKEYS } from "$lib/domain/default_hotkeys";
import type {
  EditorSettings,
  SettingsCategory,
} from "$lib/types/editor_settings";

export function register_settings_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;
  let settings_open_revision = 0;

  registry.register({
    id: ACTION_IDS.settings_open,
    label: "Open Settings",
    execute: async (arg: unknown) => {
      const category = (
        typeof arg === "string" ? arg : "theme"
      ) as SettingsCategory;
      const open_revision = ++settings_open_revision;
      const snapshot = { ...stores.ui.editor_settings };
      const draft_overrides = [...stores.ui.hotkey_overrides];
      const draft_config = services.hotkey.merge_config(
        DEFAULT_HOTKEYS,
        draft_overrides,
      );
      stores.ui.settings_dialog = {
        open: true,
        current_settings: snapshot,
        persisted_settings: snapshot,
        has_unsaved_changes: false,
        active_category: category,
        hotkey_draft_overrides: draft_overrides,
        hotkey_draft_config: draft_config,
      };

      const result = await services.settings.load_settings(
        stores.ui.editor_settings,
      );
      if (open_revision !== settings_open_revision) {
        return;
      }
      if (!stores.ui.settings_dialog.open) {
        return;
      }
      if (result.status === "success") {
        stores.ui.settings_dialog = {
          ...stores.ui.settings_dialog,
          current_settings: result.settings,
          persisted_settings: result.settings,
          has_unsaved_changes: false,
        };
        stores.ui.set_editor_settings(result.settings);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.settings_close,
    label: "Close Settings",
    execute: () => {
      if (stores.op.is_pending("settings.save")) {
        return;
      }
      settings_open_revision += 1;
      const persisted = stores.ui.settings_dialog.persisted_settings;
      stores.ui.set_editor_settings(persisted);
      const saved_overrides = [...stores.ui.hotkey_overrides];
      const saved_config = services.hotkey.merge_config(
        DEFAULT_HOTKEYS,
        saved_overrides,
      );
      stores.ui.settings_dialog = {
        ...stores.ui.settings_dialog,
        open: false,
        current_settings: persisted,
        has_unsaved_changes: false,
        hotkey_draft_overrides: saved_overrides,
        hotkey_draft_config: saved_config,
      };
      void registry.execute(ACTION_IDS.theme_revert);
      services.settings.reset_load_operation();
      services.settings.reset_save_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.settings_update,
    label: "Update Settings",
    execute: (settings: unknown) => {
      const editor_settings = settings as EditorSettings;
      stores.ui.settings_dialog = {
        ...stores.ui.settings_dialog,
        current_settings: editor_settings,
        has_unsaved_changes: true,
      };
      stores.ui.set_editor_settings(editor_settings);
    },
  });

  registry.register({
    id: ACTION_IDS.settings_save,
    label: "Save Settings",
    execute: async () => {
      const settings = stores.ui.settings_dialog.current_settings;
      const result = await services.settings.save_settings(settings);

      if (result.status === "success") {
        stores.ui.set_editor_settings(settings);
        stores.ui.settings_dialog = {
          ...stores.ui.settings_dialog,
          persisted_settings: settings,
          has_unsaved_changes: false,
        };
      }

      const draft_overrides = stores.ui.settings_dialog.hotkey_draft_overrides;
      await services.hotkey.save_hotkey_overrides(draft_overrides);
      stores.ui.hotkey_overrides = draft_overrides;
      const new_config = services.hotkey.merge_config(
        DEFAULT_HOTKEYS,
        draft_overrides,
      );
      stores.ui.set_hotkeys_config(new_config);
      stores.ui.settings_dialog = {
        ...stores.ui.settings_dialog,
        hotkey_draft_config: new_config,
      };

      await registry.execute(ACTION_IDS.theme_save);
    },
  });
}
