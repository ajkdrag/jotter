import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { Theme } from "$lib/shared/types/theme";
import {
  BUILTIN_THEMES,
  get_all_themes,
  DEFAULT_THEME_ID,
} from "$lib/shared/types/theme";

export function register_theme_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  let persisted_theme_snapshot: Theme | null = null;
  let persisted_active_theme_id: string | null = null;

  async function persist_themes() {
    await services.theme.save_user_themes(stores.ui.user_themes);
    await services.theme.save_active_theme_id(stores.ui.active_theme_id);
  }

  async function set_themes_and_active_id(
    themes: Theme[],
    active_theme_id: string,
  ) {
    stores.ui.set_user_themes(themes);
    stores.ui.set_active_theme_id(active_theme_id);
    await persist_themes();
    persisted_theme_snapshot = null;
  }

  function reset_theme_draft_state() {
    persisted_theme_snapshot = null;
    persisted_active_theme_id = null;
    stores.ui.theme_has_draft = false;
  }

  function find_theme(theme_id: string) {
    return get_all_themes(stores.ui.user_themes).find((t) => t.id === theme_id);
  }

  registry.register({
    id: ACTION_IDS.theme_load,
    label: "Load Themes",
    execute: async () => {
      const result = await services.theme.load_themes();
      stores.ui.set_user_themes(result.user_themes);
      stores.ui.set_active_theme_id(result.active_theme_id);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_switch,
    label: "Switch Theme",
    execute: (theme_id: unknown) => {
      if (typeof theme_id !== "string") return;
      if (!persisted_active_theme_id) {
        persisted_active_theme_id = stores.ui.active_theme_id;
      }
      stores.ui.set_active_theme_id(theme_id);
      stores.ui.theme_has_draft = true;
    },
  });

  registry.register({
    id: ACTION_IDS.theme_create,
    label: "Create Theme",
    execute: async (args: unknown) => {
      const { name, base } = args as { name: string; base: Theme };
      const new_theme = services.theme.duplicate_theme(name, base);
      const updated = [...stores.ui.user_themes, new_theme];
      await set_themes_and_active_id(updated, new_theme.id);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_duplicate,
    label: "Duplicate Theme",
    execute: async (theme_id: unknown) => {
      if (typeof theme_id !== "string") return;
      const source = find_theme(theme_id);
      if (!source) return;
      const new_theme = services.theme.duplicate_theme(
        `${source.name} (copy)`,
        source,
      );
      const updated = [...stores.ui.user_themes, new_theme];
      await set_themes_and_active_id(updated, new_theme.id);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_rename,
    label: "Rename Theme",
    execute: (args: unknown) => {
      const { id, name } = args as { id: string; name: string };
      const updated = stores.ui.user_themes.map((t) =>
        t.id === id ? { ...t, name } : t,
      );
      stores.ui.set_user_themes(updated);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_delete,
    label: "Delete Theme",
    execute: async (theme_id: unknown) => {
      if (typeof theme_id !== "string") return;
      if (BUILTIN_THEMES.some((t) => t.id === theme_id)) return;
      const updated = stores.ui.user_themes.filter((t) => t.id !== theme_id);
      stores.ui.set_user_themes(updated);
      if (stores.ui.active_theme_id === theme_id) {
        stores.ui.set_active_theme_id(DEFAULT_THEME_ID);
      }
      await persist_themes();
      persisted_theme_snapshot = null;
    },
  });

  registry.register({
    id: ACTION_IDS.theme_update,
    label: "Update Theme (draft)",
    execute: (args: unknown) => {
      const theme = args as Theme;
      if (theme.is_builtin) return;
      if (!persisted_theme_snapshot) {
        const current = stores.ui.user_themes.find((t) => t.id === theme.id);
        if (current) persisted_theme_snapshot = { ...current };
      }
      const updated = stores.ui.user_themes.map((t) =>
        t.id === theme.id ? theme : t,
      );
      stores.ui.set_user_themes(updated);
      stores.ui.theme_has_draft = true;
    },
  });

  registry.register({
    id: ACTION_IDS.theme_save,
    label: "Save Themes",
    execute: async () => {
      await persist_themes();
      reset_theme_draft_state();
    },
  });

  registry.register({
    id: ACTION_IDS.theme_revert,
    label: "Revert Theme Changes",
    execute: () => {
      if (persisted_theme_snapshot) {
        const snapshot = persisted_theme_snapshot;
        const updated = stores.ui.user_themes.map((t) =>
          t.id === snapshot.id ? snapshot : t,
        );
        stores.ui.set_user_themes(updated);
        persisted_theme_snapshot = null;
      }
      if (persisted_active_theme_id) {
        stores.ui.set_active_theme_id(persisted_active_theme_id);
      }
      reset_theme_draft_state();
    },
  });
}
