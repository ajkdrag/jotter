import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { Theme } from "$lib/shared/types/theme";
import {
  BUILTIN_THEMES,
  get_all_themes,
  DEFAULT_THEME_ID,
} from "$lib/shared/types/theme";

export function register_theme_actions(input: ActionRegistrationInput): void {
  const { registry, stores, services } = input;

  let persisted_user_themes_snapshot: Theme[] | null = null;
  let persisted_active_theme_id: string | null = null;

  async function persist_themes(): Promise<void> {
    await services.theme.save_user_themes(stores.ui.user_themes);
    await services.theme.save_active_theme_id(stores.ui.active_theme_id);
  }

  function clone_theme(theme: Theme): Theme {
    return {
      ...theme,
      token_overrides: { ...theme.token_overrides },
    };
  }

  function clone_themes(themes: Theme[]): Theme[] {
    return themes.map(clone_theme);
  }

  function set_themes_and_active_id(
    themes: Theme[],
    active_theme_id: string,
  ): void {
    stores.ui.set_user_themes(themes);
    stores.ui.set_active_theme_id(active_theme_id);
  }

  function capture_draft_snapshot(): void {
    if (persisted_user_themes_snapshot === null) {
      persisted_user_themes_snapshot = clone_themes(stores.ui.user_themes);
    }
    if (persisted_active_theme_id === null) {
      persisted_active_theme_id = stores.ui.active_theme_id;
    }
  }

  function mark_theme_draft(): void {
    capture_draft_snapshot();
    stores.ui.theme_has_draft = true;
  }

  function reset_theme_draft_state(): void {
    persisted_user_themes_snapshot = null;
    persisted_active_theme_id = null;
    stores.ui.theme_has_draft = false;
  }

  function find_theme(theme_id: string): Theme | undefined {
    return get_all_themes(stores.ui.user_themes).find((t) => t.id === theme_id);
  }

  registry.register({
    id: ACTION_IDS.theme_load,
    label: "Load Themes",
    execute: async () => {
      const result = await services.theme.load_themes();
      stores.ui.set_user_themes(result.user_themes);
      stores.ui.set_active_theme_id(result.active_theme_id);
      reset_theme_draft_state();
    },
  });

  registry.register({
    id: ACTION_IDS.theme_switch,
    label: "Switch Theme",
    execute: (theme_id: unknown) => {
      if (typeof theme_id !== "string") return;
      if (theme_id === stores.ui.active_theme_id) return;
      mark_theme_draft();
      stores.ui.set_active_theme_id(theme_id);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_create,
    label: "Create Theme",
    execute: (args: unknown) => {
      const { name, base } = args as { name: string; base: Theme };
      mark_theme_draft();
      const new_theme = services.theme.duplicate_theme(name, base);
      const updated = [...stores.ui.user_themes, new_theme];
      set_themes_and_active_id(updated, new_theme.id);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_duplicate,
    label: "Duplicate Theme",
    execute: (theme_id: unknown) => {
      if (typeof theme_id !== "string") return;
      const source = find_theme(theme_id);
      if (!source) return;
      mark_theme_draft();
      const new_theme = services.theme.duplicate_theme(
        `${source.name} (copy)`,
        source,
      );
      const updated = [...stores.ui.user_themes, new_theme];
      set_themes_and_active_id(updated, new_theme.id);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_rename,
    label: "Rename Theme",
    execute: (args: unknown) => {
      const { id, name } = args as { id: string; name: string };
      mark_theme_draft();
      const updated = stores.ui.user_themes.map((t) =>
        t.id === id ? { ...t, name } : t,
      );
      stores.ui.set_user_themes(updated);
    },
  });

  registry.register({
    id: ACTION_IDS.theme_delete,
    label: "Delete Theme",
    execute: (theme_id: unknown) => {
      if (typeof theme_id !== "string") return;
      if (BUILTIN_THEMES.some((t) => t.id === theme_id)) return;
      mark_theme_draft();
      const updated = stores.ui.user_themes.filter((t) => t.id !== theme_id);
      stores.ui.set_user_themes(updated);
      if (stores.ui.active_theme_id === theme_id) {
        stores.ui.set_active_theme_id(DEFAULT_THEME_ID);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.theme_update,
    label: "Update Theme (draft)",
    execute: (args: unknown) => {
      const theme = args as Theme;
      if (theme.is_builtin) return;
      mark_theme_draft();
      const updated = stores.ui.user_themes.map((t) =>
        t.id === theme.id ? theme : t,
      );
      stores.ui.set_user_themes(updated);
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
      if (persisted_user_themes_snapshot !== null) {
        stores.ui.set_user_themes(clone_themes(persisted_user_themes_snapshot));
      }
      if (persisted_active_theme_id !== null) {
        stores.ui.set_active_theme_id(persisted_active_theme_id);
      }
      reset_theme_draft_state();
    },
  });
}
