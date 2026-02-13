import { describe, expect, it, vi } from "vitest";
import { ActionRegistry } from "$lib/actions/registry";
import { ACTION_IDS } from "$lib/actions/action_ids";
import { register_vault_actions } from "$lib/actions/register_vault_actions";
import { UIStore } from "$lib/stores/ui_store.svelte";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { SearchStore } from "$lib/stores/search_store.svelte";
import { as_vault_id } from "$lib/types/ids";
import {
  create_open_note_state,
  create_test_note,
} from "../helpers/test_fixtures";

function create_vault_actions_harness() {
  const registry = new ActionRegistry();
  const stores = {
    ui: new UIStore(),
    vault: new VaultStore(),
    notes: new NotesStore(),
    editor: new EditorStore(),
    op: new OpStore(),
    search: new SearchStore(),
  };

  const services = {
    vault: {
      choose_vault_path: vi.fn(),
      change_vault_by_path: vi.fn(),
      change_vault_by_id: vi.fn().mockResolvedValue({
        status: "failed",
        error: "switch blocked",
      }),
      select_pinned_vault_by_slot: vi.fn(),
      toggle_vault_pin: vi.fn(),
      rebuild_index: vi.fn(),
      reset_change_operation: vi.fn(),
    },
    note: {},
    folder: {},
    settings: {},
    search: {},
    editor: {},
    clipboard: {},
    shell: {},
  };

  register_vault_actions({
    registry,
    stores,
    services: services as never,
    default_mount_config: {
      reset_app_state: true,
      bootstrap_default_vault_path: null,
    },
  });

  return { registry, stores, services };
}

describe("register_vault_actions", () => {
  it("prompts before switching when current note has unsaved changes", async () => {
    const { registry, stores, services } = create_vault_actions_harness();
    const note = create_test_note("docs/current", "Current");
    stores.editor.set_open_note(create_open_note_state(note));
    stores.editor.set_dirty(note.id, true);

    const target_vault_id = as_vault_id("vault-next");
    await registry.execute(ACTION_IDS.vault_select, target_vault_id);

    expect(stores.ui.change_vault.confirm_discard_open).toBe(true);
    expect(services.vault.change_vault_by_id).not.toHaveBeenCalled();

    await registry.execute(ACTION_IDS.vault_confirm_discard_change);

    expect(stores.ui.change_vault.confirm_discard_open).toBe(false);
    expect(services.vault.change_vault_by_id).toHaveBeenCalledWith(
      target_vault_id,
    );
  });

  it("cancels pending vault switch when discard confirm is dismissed", async () => {
    const { registry, stores, services } = create_vault_actions_harness();
    const note = create_test_note("docs/current", "Current");
    stores.editor.set_open_note(create_open_note_state(note));
    stores.editor.set_dirty(note.id, true);

    await registry.execute(ACTION_IDS.vault_select, as_vault_id("vault-next"));
    expect(stores.ui.change_vault.confirm_discard_open).toBe(true);

    await registry.execute(ACTION_IDS.vault_cancel_discard_change);
    expect(stores.ui.change_vault.confirm_discard_open).toBe(false);

    await registry.execute(ACTION_IDS.vault_confirm_discard_change);
    expect(services.vault.change_vault_by_id).not.toHaveBeenCalled();
  });
});
