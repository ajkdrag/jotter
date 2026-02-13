import { describe, expect, it, vi } from "vitest";
import { ActionRegistry } from "$lib/actions/registry";
import { ACTION_IDS } from "$lib/actions/action_ids";
import { register_omnibar_actions } from "$lib/actions/register_omnibar_actions";
import { UIStore } from "$lib/stores/ui_store.svelte";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { SearchStore } from "$lib/stores/search_store.svelte";
import { as_note_path, as_vault_id } from "$lib/types/ids";
import { create_test_note, create_test_vault } from "../helpers/test_fixtures";

function create_omnibar_actions_harness() {
  const registry = new ActionRegistry();
  const stores = {
    ui: new UIStore(),
    vault: new VaultStore(),
    notes: new NotesStore(),
    editor: new EditorStore(),
    op: new OpStore(),
    search: new SearchStore(),
  };
  const execute_vault_select = vi.fn((vault_id: unknown) => {
    stores.vault.set_vault(
      create_test_vault({ id: vault_id as ReturnType<typeof as_vault_id> }),
    );
    return Promise.resolve();
  });
  const execute_note_open = vi.fn().mockResolvedValue(undefined);

  const services = {
    vault: {
      choose_vault_path: vi.fn(),
      change_vault_by_path: vi.fn(),
      change_vault_by_id: vi.fn().mockResolvedValue({
        status: "opened",
        editor_settings: stores.ui.editor_settings,
      }),
      select_pinned_vault_by_slot: vi.fn(),
      remove_vault_from_registry: vi.fn(),
      toggle_vault_pin: vi.fn(),
      rebuild_index: vi.fn(),
      reset_change_operation: vi.fn(),
    },
    note: {
      open_note: vi.fn(),
    },
    folder: {},
    settings: {},
    search: {
      search_omnibar: vi.fn().mockResolvedValue({ domain: "notes", items: [] }),
      search_notes_all_vaults: vi.fn().mockResolvedValue({
        status: "success",
        groups: [],
      }),
      reset_search_notes_operation: vi.fn(),
    },
    editor: {},
    clipboard: {},
    shell: {},
  };

  register_omnibar_actions({
    registry,
    stores,
    services: services as never,
    default_mount_config: {
      reset_app_state: true,
      bootstrap_default_vault_path: null,
    },
  });

  registry.register({
    id: ACTION_IDS.vault_select,
    label: "Select Vault",
    execute: execute_vault_select,
  });

  registry.register({
    id: ACTION_IDS.note_open,
    label: "Open Note",
    execute: execute_note_open,
  });

  return {
    registry,
    stores,
    services,
    execute_vault_select,
    execute_note_open,
  };
}

describe("register_omnibar_actions", () => {
  it("opens note after selecting cross-vault hit", async () => {
    const { registry, stores, execute_vault_select, execute_note_open } =
      create_omnibar_actions_harness();
    stores.vault.set_vault(create_test_vault({ id: as_vault_id("vault-a") }));
    const note = create_test_note("docs/alpha", "Alpha");

    await registry.execute(ACTION_IDS.omnibar_confirm_item, {
      kind: "cross_vault_note",
      note,
      vault_id: as_vault_id("vault-b"),
      vault_name: "Vault B",
      score: 1,
      snippet: "alpha",
    });

    expect(execute_vault_select).toHaveBeenCalledWith(as_vault_id("vault-b"));
    expect(execute_note_open).toHaveBeenCalledWith({
      note_path: note.id,
      cleanup_if_missing: true,
    });
  });

  it("switches scope and searches across all vaults", async () => {
    const { registry, stores, services } = create_omnibar_actions_harness();

    stores.ui.omnibar = {
      ...stores.ui.omnibar,
      open: true,
      query: "machine learning",
      scope: "current_vault",
    };

    await registry.execute(ACTION_IDS.omnibar_set_scope, "all_vaults");

    expect(stores.ui.omnibar.scope).toBe("all_vaults");
    expect(services.search.search_notes_all_vaults).toHaveBeenCalledWith(
      "machine learning",
    );
  });

  it("maps grouped all-vault results into omnibar cross-vault items", async () => {
    const { registry, stores, services } = create_omnibar_actions_harness();

    services.search.search_notes_all_vaults = vi.fn().mockResolvedValue({
      status: "success",
      groups: [
        {
          vault_id: as_vault_id("vault-b"),
          vault_name: "Vault B",
          vault_path: "/vault/b",
          results: [
            {
              note: {
                id: as_note_path("ml.md"),
                path: as_note_path("ml.md"),
                name: "ml",
                title: "ML",
                mtime_ms: 0,
                size_bytes: 0,
              },
              score: 0.9,
              snippet: "machine learning",
            },
          ],
        },
      ],
    });

    stores.ui.omnibar = {
      ...stores.ui.omnibar,
      open: true,
      query: "machine learning",
      scope: "all_vaults",
    };

    await registry.execute(ACTION_IDS.omnibar_set_query, "machine learning");

    expect(stores.search.omnibar_items).toHaveLength(1);
    expect(stores.search.omnibar_items[0]).toMatchObject({
      kind: "cross_vault_note",
      vault_name: "Vault B",
    });
  });
});
