import { describe, expect, it } from "vitest";
import { ActionRegistry } from "$lib/actions/registry";
import { ACTION_IDS } from "$lib/actions/action_ids";
import { register_ui_actions } from "$lib/actions/register_ui_actions";
import { UIStore } from "$lib/stores/ui_store.svelte";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { SearchStore } from "$lib/stores/search_store.svelte";
import { TabStore } from "$lib/stores/tab_store.svelte";
import { GitStore } from "$lib/stores/git_store.svelte";

describe("register_ui_actions", () => {
  it("opens and closes vault dashboard", async () => {
    const registry = new ActionRegistry();
    const stores = {
      ui: new UIStore(),
      vault: new VaultStore(),
      notes: new NotesStore(),
      editor: new EditorStore(),
      op: new OpStore(),
      search: new SearchStore(),
      tab: new TabStore(),
      git: new GitStore(),
    };

    register_ui_actions({
      registry,
      stores,
      services: {
        shell: { open_url: async () => {} },
        vault: { set_theme: () => ({ status: "success" as const }) },
      } as never,
      default_mount_config: {
        reset_app_state: true,
        bootstrap_default_vault_path: null,
      },
    });

    expect(stores.ui.vault_dashboard.open).toBe(false);

    await registry.execute(ACTION_IDS.ui_open_vault_dashboard);
    expect(stores.ui.vault_dashboard.open).toBe(true);

    await registry.execute(ACTION_IDS.ui_close_vault_dashboard);
    expect(stores.ui.vault_dashboard.open).toBe(false);
  });

  it("accepts dashboard sidebar view", async () => {
    const registry = new ActionRegistry();
    const stores = {
      ui: new UIStore(),
      vault: new VaultStore(),
      notes: new NotesStore(),
      editor: new EditorStore(),
      op: new OpStore(),
      search: new SearchStore(),
      tab: new TabStore(),
      git: new GitStore(),
    };

    register_ui_actions({
      registry,
      stores,
      services: {
        shell: { open_url: async () => {} },
        vault: { set_theme: () => ({ status: "success" as const }) },
      } as never,
      default_mount_config: {
        reset_app_state: true,
        bootstrap_default_vault_path: null,
      },
    });

    expect(stores.ui.sidebar_view).toBe("explorer");
    await registry.execute(ACTION_IDS.ui_set_sidebar_view, "dashboard");
    expect(stores.ui.sidebar_view).toBe("dashboard");
  });
});
