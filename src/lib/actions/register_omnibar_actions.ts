import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import type { OmnibarItem, OmnibarScope } from "$lib/types/search";
import type { CommandId } from "$lib/types/command_palette";
import { COMMANDS_REGISTRY } from "$lib/domain/search_commands";
import { parse_search_query } from "$lib/domain/search_query_parser";
import { as_note_path, type VaultId } from "$lib/types/ids";

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
    scope: "current_vault",
  };
  input.stores.search.clear_omnibar();
  input.services.search.reset_search_notes_operation();
}

function clear_cross_vault_open_confirm(input: ActionRegistrationInput) {
  input.stores.ui.cross_vault_open_confirm = {
    open: false,
    target_vault_id: null,
    target_vault_name: "",
    note_path: null,
  };
}

function is_unavailable_vault_error(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("vault unavailable") ||
    normalized.includes("could not be found") ||
    normalized.includes("no such file or directory")
  );
}

function mark_vault_unavailable(
  input: ActionRegistrationInput,
  vault_id: VaultId,
) {
  input.stores.vault.set_vault_availability(vault_id, false);
  input.stores.search.set_omnibar_items(
    input.stores.search.omnibar_items.map((item) => {
      if (item.kind !== "cross_vault_note" || item.vault_id !== vault_id) {
        return item;
      }
      return {
        ...item,
        vault_is_available: false,
      };
    }),
  );
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
    case "open_hotkeys":
      await registry.execute(ACTION_IDS.settings_open, "hotkeys");
      break;
    case "reindex_vault":
      await registry.execute(ACTION_IDS.vault_reindex);
      break;
    case "show_vault_dashboard":
      await registry.execute(ACTION_IDS.ui_open_vault_dashboard);
      break;
    case "git_version_history":
      await registry.execute(ACTION_IDS.git_open_history);
      break;
    case "git_create_checkpoint":
      await registry.execute(ACTION_IDS.git_open_checkpoint);
      break;
    case "git_init_repo":
      await registry.execute(ACTION_IDS.git_init);
      break;
    case "toggle_links_panel":
      await registry.execute(ACTION_IDS.ui_toggle_context_rail);
      break;
  }
}

async function confirm_item(input: ActionRegistrationInput, item: OmnibarItem) {
  const { registry } = input;

  switch (item.kind) {
    case "note":
    case "recent_note":
      close_omnibar(input);
      await registry.execute(ACTION_IDS.note_open, {
        note_path: item.note.id,
        cleanup_if_missing: true,
      });
      break;
    case "cross_vault_note":
      if (
        input.stores.vault.recent_vaults.some(
          (vault) => vault.id === item.vault_id && vault.is_available === false,
        )
      ) {
        mark_vault_unavailable(input, item.vault_id as VaultId);
        return;
      }

      close_omnibar(input);
      if (input.stores.vault.vault?.id !== item.vault_id) {
        input.stores.ui.cross_vault_open_confirm = {
          open: true,
          target_vault_id: item.vault_id as VaultId,
          target_vault_name: item.vault_name,
          note_path: item.note.id,
        };
        return;
      }
      await registry.execute(ACTION_IDS.note_open, {
        note_path: item.note.id,
        cleanup_if_missing: true,
      });
      break;
    case "command":
      close_omnibar(input);
      input.stores.ui.add_recent_command(
        item.command.id,
        COMMANDS_REGISTRY.length,
      );
      await execute_command(input, item.command.id);
      break;
    case "setting":
      close_omnibar(input);
      await registry.execute(
        ACTION_IDS.settings_open,
        item.setting.category.toLowerCase(),
      );
      break;
    case "planned_note":
      close_omnibar(input);
      await registry.execute(
        ACTION_IDS.note_open_wiki_link,
        as_note_path(item.target_path),
      );
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
      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        open: true,
        query: ">",
        selected_index: 0,
        is_searching: false,
      };
      stores.search.clear_omnibar();
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
    id: ACTION_IDS.omnibar_open_all_vaults,
    label: "Open Omnibar (All Vaults)",
    execute: () => {
      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        open: true,
        query: "",
        selected_index: 0,
        is_searching: false,
        scope: "all_vaults",
      };
      stores.search.clear_omnibar();
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
        services.search.reset_search_notes_operation();
        return;
      }

      stores.ui.omnibar = { ...stores.ui.omnibar, is_searching: true };
      const parsed_query = parse_search_query(normalized_query);

      if (
        stores.ui.omnibar.scope === "all_vaults" &&
        parsed_query.domain === "notes"
      ) {
        const result =
          await services.search.search_notes_all_vaults(normalized_query);
        if (stores.ui.omnibar.query !== normalized_query) return;
        if (stores.ui.omnibar.scope !== "all_vaults") return;
        const items: OmnibarItem[] = result.groups.flatMap((group) =>
          group.results.map((r) => ({
            kind: "cross_vault_note" as const,
            note: r.note,
            vault_id: group.vault_id,
            vault_name: group.vault_name,
            vault_note_count: group.vault_note_count,
            vault_last_opened_at: group.vault_last_opened_at,
            vault_is_available: group.vault_is_available,
            score: r.score,
            snippet: r.snippet,
          })),
        );
        stores.search.set_omnibar_items(items);
      } else {
        const result = await services.search.search_omnibar(normalized_query);
        if (stores.ui.omnibar.query !== normalized_query) return;
        stores.search.set_omnibar_items(result.items);
      }

      const clamped_index =
        stores.search.omnibar_items.length > 0
          ? Math.min(
              stores.ui.omnibar.selected_index,
              stores.search.omnibar_items.length - 1,
            )
          : 0;
      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        is_searching: false,
        selected_index: clamped_index,
      };
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
    id: ACTION_IDS.omnibar_set_scope,
    label: "Set Omnibar Scope",
    execute: async (scope: unknown) => {
      const new_scope = scope as OmnibarScope;
      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        scope: new_scope,
        selected_index: 0,
      };
      stores.search.clear_omnibar();

      const current_query = stores.ui.omnibar.query.trim();
      if (!current_query) return;

      stores.ui.omnibar = { ...stores.ui.omnibar, is_searching: true };
      const parsed_query = parse_search_query(current_query);

      if (new_scope === "all_vaults" && parsed_query.domain === "notes") {
        const result =
          await services.search.search_notes_all_vaults(current_query);
        if (stores.ui.omnibar.scope !== "all_vaults") return;
        if (stores.ui.omnibar.query.trim() !== current_query) return;
        const items: OmnibarItem[] = result.groups.flatMap((group) =>
          group.results.map((r) => ({
            kind: "cross_vault_note" as const,
            note: r.note,
            vault_id: group.vault_id,
            vault_name: group.vault_name,
            vault_note_count: group.vault_note_count,
            vault_last_opened_at: group.vault_last_opened_at,
            vault_is_available: group.vault_is_available,
            score: r.score,
            snippet: r.snippet,
          })),
        );
        stores.search.set_omnibar_items(items);
      } else {
        const result = await services.search.search_omnibar(current_query);
        if (stores.ui.omnibar.scope !== "current_vault") return;
        if (stores.ui.omnibar.query.trim() !== current_query) return;
        stores.search.set_omnibar_items(result.items);
      }

      const clamped =
        stores.search.omnibar_items.length > 0
          ? Math.min(
              stores.ui.omnibar.selected_index,
              stores.search.omnibar_items.length - 1,
            )
          : 0;
      stores.ui.omnibar = {
        ...stores.ui.omnibar,
        is_searching: false,
        selected_index: clamped,
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

  registry.register({
    id: ACTION_IDS.omnibar_confirm_cross_vault_open,
    label: "Confirm Open Cross-Vault Note",
    execute: async () => {
      const pending = stores.ui.cross_vault_open_confirm;
      const target_vault_id = pending.target_vault_id;
      const note_path = pending.note_path;
      clear_cross_vault_open_confirm(input);
      if (!target_vault_id || !note_path) {
        return;
      }

      if (stores.vault.vault?.id !== target_vault_id) {
        await registry.execute(ACTION_IDS.vault_select, target_vault_id);
      }
      if (stores.vault.vault?.id !== target_vault_id) {
        const vault_change_error = stores.ui.change_vault.error;
        if (
          vault_change_error &&
          is_unavailable_vault_error(vault_change_error)
        ) {
          mark_vault_unavailable(input, target_vault_id);
        }
        return;
      }

      await registry.execute(ACTION_IDS.note_open, {
        note_path: as_note_path(note_path),
        cleanup_if_missing: true,
      });
    },
  });

  registry.register({
    id: ACTION_IDS.omnibar_cancel_cross_vault_open,
    label: "Cancel Open Cross-Vault Note",
    execute: () => {
      clear_cross_vault_open_confirm(input);
    },
  });
}
