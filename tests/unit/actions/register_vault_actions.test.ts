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
import { as_vault_id, as_vault_path } from "$lib/types/ids";
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
      remove_vault_from_registry: vi.fn(),
      toggle_vault_pin: vi.fn(),
      rebuild_index: vi.fn(),
      reset_change_operation: vi.fn(),
    },
    note: {
      save_note: vi.fn().mockResolvedValue({
        status: "saved",
        saved_path: "docs/current.md",
      }),
    },
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
    stores.ui.change_vault.open = true;
    await registry.execute(ACTION_IDS.vault_select, target_vault_id);

    expect(stores.ui.change_vault.confirm_discard_open).toBe(true);
    expect(stores.ui.change_vault.open).toBe(false);
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

    stores.ui.change_vault.open = true;
    await registry.execute(ACTION_IDS.vault_select, as_vault_id("vault-next"));
    expect(stores.ui.change_vault.confirm_discard_open).toBe(true);

    await registry.execute(ACTION_IDS.vault_cancel_discard_change);
    expect(stores.ui.change_vault.confirm_discard_open).toBe(false);
    expect(stores.ui.change_vault.open).toBe(true);

    await registry.execute(ACTION_IDS.vault_confirm_discard_change);
    expect(services.vault.change_vault_by_id).not.toHaveBeenCalled();
  });

  it("saves before switching when save-and-switch is confirmed", async () => {
    const { registry, stores, services } = create_vault_actions_harness();
    const note = create_test_note("docs/current", "Current");
    stores.editor.set_open_note(create_open_note_state(note));
    stores.editor.set_dirty(note.id, true);

    const target_vault_id = as_vault_id("vault-next");
    await registry.execute(ACTION_IDS.vault_select, target_vault_id);
    await registry.execute(ACTION_IDS.vault_confirm_save_change);

    expect(services.note.save_note).toHaveBeenCalledWith(null, true);
    expect(services.vault.change_vault_by_id).toHaveBeenCalledWith(
      target_vault_id,
    );
    expect(stores.ui.change_vault.confirm_discard_open).toBe(false);
  });

  it("keeps confirm dialog open with error when save fails", async () => {
    const { registry, stores, services } = create_vault_actions_harness();
    const note = create_test_note("docs/current", "Current");
    stores.editor.set_open_note(create_open_note_state(note));
    stores.editor.set_dirty(note.id, true);
    services.note.save_note = vi.fn().mockResolvedValue({
      status: "failed",
      error: "disk full",
    });

    await registry.execute(ACTION_IDS.vault_select, as_vault_id("vault-next"));
    await registry.execute(ACTION_IDS.vault_confirm_save_change);

    expect(services.vault.change_vault_by_id).not.toHaveBeenCalled();
    expect(stores.ui.change_vault.confirm_discard_open).toBe(true);
    expect(stores.ui.change_vault.error).toBe("disk full");
    expect(stores.ui.change_vault.is_loading).toBe(false);
  });

  it("marks selected vault unavailable when open fails with missing path", async () => {
    const { registry, stores, services } = create_vault_actions_harness();
    const target_vault_id = as_vault_id("vault-missing");
    stores.vault.set_recent_vaults([
      {
        id: target_vault_id,
        name: "Missing Vault",
        path: as_vault_path("/vault/missing"),
        created_at: 1,
        is_available: true,
      },
    ]);

    services.vault.change_vault_by_id = vi.fn().mockResolvedValue({
      status: "failed",
      error:
        "A requested file or directory could not be found at the time an operation was processed.",
    });

    await registry.execute(ACTION_IDS.vault_select, target_vault_id);

    expect(stores.vault.recent_vaults[0]?.is_available).toBe(false);
  });
});
