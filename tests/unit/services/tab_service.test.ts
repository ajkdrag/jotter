import { describe, expect, it, vi } from "vitest";
import { TabService } from "$lib/services/tab_service";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { TabStore } from "$lib/stores/tab_store.svelte";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import { as_note_path, as_vault_id } from "$lib/types/ids";
import type { CursorInfo } from "$lib/types/editor";
import type { PersistedTabState } from "$lib/types/tab";
import { create_test_vault } from "../helpers/test_fixtures";

function create_setup() {
  const vault_settings_port = {
    get_vault_setting: vi.fn().mockResolvedValue(null),
    set_vault_setting: vi.fn().mockResolvedValue(undefined),
  };
  const vault_store = new VaultStore();
  vault_store.set_vault(create_test_vault({ id: as_vault_id("vault-a") }));
  const tab_store = new TabStore();
  const notes_store = new NotesStore();
  const note_service = {
    open_note: vi.fn().mockResolvedValue({ status: "opened" }),
  };
  const service = new TabService(
    vault_settings_port as never,
    vault_store,
    tab_store,
    notes_store,
    note_service as never,
  );

  return {
    service,
    vault_settings_port,
    vault_store,
    tab_store,
    notes_store,
    note_service,
  };
}

describe("TabService", () => {
  describe("save_tabs", () => {
    it("persists tabs with note paths and pin state", async () => {
      const { service, vault_settings_port, tab_store, notes_store } =
        create_setup();

      const alpha = as_note_path("docs/alpha.md");
      const beta = as_note_path("docs/beta.md");
      notes_store.set_notes([
        {
          id: alpha,
          path: alpha,
          name: "alpha",
          title: "alpha",
          mtime_ms: 0,
          size_bytes: 0,
        },
        {
          id: beta,
          path: beta,
          name: "beta",
          title: "beta",
          mtime_ms: 0,
          size_bytes: 0,
        },
      ]);

      tab_store.open_tab(alpha, "alpha");
      tab_store.open_tab(beta, "beta");
      tab_store.pin_tab(beta);

      await service.save_tabs();

      expect(vault_settings_port.set_vault_setting).toHaveBeenCalledWith(
        as_vault_id("vault-a"),
        "open_tabs",
        {
          tabs: [
            { note_path: beta, is_pinned: true, cursor: null },
            { note_path: alpha, is_pinned: false, cursor: null },
          ],
          active_tab_path: beta,
        },
      );
    });

    it("includes cursor from editor snapshots in persisted state", async () => {
      const { service, vault_settings_port, tab_store, notes_store } =
        create_setup();

      const alpha = as_note_path("docs/alpha.md");
      const beta = as_note_path("docs/beta.md");
      notes_store.set_notes([
        {
          id: alpha,
          path: alpha,
          name: "alpha",
          title: "alpha",
          mtime_ms: 0,
          size_bytes: 0,
        },
        {
          id: beta,
          path: beta,
          name: "beta",
          title: "beta",
          mtime_ms: 0,
          size_bytes: 0,
        },
      ]);

      tab_store.open_tab(alpha, "alpha");
      tab_store.open_tab(beta, "beta");

      const alpha_cursor: CursorInfo = {
        line: 2,
        column: 3,
        total_lines: 20,
        total_words: 0,
      };
      const beta_cursor: CursorInfo = {
        line: 9,
        column: 1,
        total_lines: 20,
        total_words: 0,
      };
      tab_store.set_snapshot(alpha, { scroll_top: 0, cursor: alpha_cursor });
      tab_store.set_snapshot(beta, { scroll_top: 0, cursor: beta_cursor });

      await service.save_tabs();

      expect(vault_settings_port.set_vault_setting).toHaveBeenCalledWith(
        as_vault_id("vault-a"),
        "open_tabs",
        {
          tabs: [
            { note_path: alpha, is_pinned: false, cursor: alpha_cursor },
            { note_path: beta, is_pinned: false, cursor: beta_cursor },
          ],
          active_tab_path: beta,
        },
      );
    });

    it("excludes tabs not found in notes index", async () => {
      const { service, vault_settings_port, tab_store, notes_store } =
        create_setup();

      const known = as_note_path("docs/known.md");
      const missing = as_note_path("docs/missing.md");
      notes_store.set_notes([
        {
          id: known,
          path: known,
          name: "known",
          title: "known",
          mtime_ms: 0,
          size_bytes: 0,
        },
      ]);

      tab_store.open_tab(known, "known");
      tab_store.open_tab(missing, "missing");

      await service.save_tabs();

      expect(vault_settings_port.set_vault_setting).toHaveBeenCalledWith(
        as_vault_id("vault-a"),
        "open_tabs",
        {
          tabs: [{ note_path: known, is_pinned: false, cursor: null }],
          active_tab_path: null,
        },
      );
    });

    it("persists active tab path", async () => {
      const { service, vault_settings_port, tab_store, notes_store } =
        create_setup();

      const alpha = as_note_path("docs/alpha.md");
      const beta = as_note_path("docs/beta.md");
      notes_store.set_notes([
        {
          id: alpha,
          path: alpha,
          name: "alpha",
          title: "alpha",
          mtime_ms: 0,
          size_bytes: 0,
        },
        {
          id: beta,
          path: beta,
          name: "beta",
          title: "beta",
          mtime_ms: 0,
          size_bytes: 0,
        },
      ]);

      tab_store.open_tab(alpha, "alpha");
      tab_store.open_tab(beta, "beta");
      tab_store.activate_tab(alpha);

      await service.save_tabs();

      expect(vault_settings_port.set_vault_setting).toHaveBeenCalledWith(
        as_vault_id("vault-a"),
        "open_tabs",
        {
          tabs: [
            { note_path: alpha, is_pinned: false, cursor: null },
            { note_path: beta, is_pinned: false, cursor: null },
          ],
          active_tab_path: alpha,
        },
      );
    });
  });

  describe("restore_tabs", () => {
    it("creates tab objects from persisted state", async () => {
      const { service, tab_store } = create_setup();

      const persisted: PersistedTabState = {
        tabs: [
          {
            note_path: as_note_path("docs/alpha.md"),
            is_pinned: false,
            cursor: null,
          },
          {
            note_path: as_note_path("docs/beta.md"),
            is_pinned: true,
            cursor: null,
          },
        ],
        active_tab_path: as_note_path("docs/alpha.md"),
      };

      await service.restore_tabs(persisted);

      expect(tab_store.tabs).toEqual([
        {
          id: as_note_path("docs/alpha.md"),
          note_path: as_note_path("docs/alpha.md"),
          title: "alpha",
          is_pinned: false,
          is_dirty: false,
        },
        {
          id: as_note_path("docs/beta.md"),
          note_path: as_note_path("docs/beta.md"),
          title: "beta",
          is_pinned: true,
          is_dirty: false,
        },
      ]);
      expect(tab_store.active_tab_id).toBe(as_note_path("docs/alpha.md"));
    });

    it("restores cursor from persisted data to editor snapshots", async () => {
      const { service, tab_store } = create_setup();

      const alpha_cursor: CursorInfo = {
        line: 5,
        column: 10,
        total_lines: 40,
        total_words: 0,
      };
      const persisted: PersistedTabState = {
        tabs: [
          {
            note_path: as_note_path("docs/alpha.md"),
            is_pinned: false,
            cursor: alpha_cursor,
          },
          {
            note_path: as_note_path("docs/beta.md"),
            is_pinned: false,
            cursor: null,
          },
        ],
        active_tab_path: as_note_path("docs/alpha.md"),
      };

      await service.restore_tabs(persisted);

      expect(tab_store.get_snapshot(as_note_path("docs/alpha.md"))).toEqual({
        scroll_top: 0,
        cursor: alpha_cursor,
      });
      expect(tab_store.get_snapshot(as_note_path("docs/beta.md"))).toBeNull();
    });

    it("opens active note on restore", async () => {
      const { service, note_service } = create_setup();

      const persisted: PersistedTabState = {
        tabs: [
          {
            note_path: as_note_path("docs/alpha.md"),
            is_pinned: false,
            cursor: null,
          },
        ],
        active_tab_path: as_note_path("docs/alpha.md"),
      };

      await service.restore_tabs(persisted);

      expect(note_service.open_note).toHaveBeenCalledWith(
        as_note_path("docs/alpha.md"),
        false,
      );
    });

    it("handles empty persisted state", async () => {
      const { service, tab_store, note_service } = create_setup();

      await service.restore_tabs({
        tabs: [],
        active_tab_path: null,
      });

      expect(tab_store.tabs).toEqual([]);
      expect(tab_store.active_tab_id).toBeNull();
      expect(note_service.open_note).not.toHaveBeenCalled();
    });
  });

  describe("sync_dirty_state", () => {
    it("delegates to tab_store.set_dirty", () => {
      const { service, tab_store } = create_setup();
      const alpha = as_note_path("docs/alpha.md");
      tab_store.open_tab(alpha, "alpha");

      service.sync_dirty_state(alpha, true);

      expect(tab_store.find_tab_by_path(alpha)?.is_dirty).toBe(true);
    });
  });

  describe("load_tabs", () => {
    it("reads persisted tab state from vault settings", async () => {
      const { service, vault_settings_port } = create_setup();

      const persisted: PersistedTabState = {
        tabs: [
          {
            note_path: as_note_path("docs/alpha.md"),
            is_pinned: true,
            cursor: { line: 1, column: 1, total_lines: 1, total_words: 0 },
          },
        ],
        active_tab_path: as_note_path("docs/alpha.md"),
      };
      vault_settings_port.get_vault_setting.mockResolvedValueOnce(persisted);

      const result = await service.load_tabs();

      expect(vault_settings_port.get_vault_setting).toHaveBeenCalledWith(
        as_vault_id("vault-a"),
        "open_tabs",
      );
      expect(result).toEqual(persisted);
    });

    it("returns null when no persisted state", async () => {
      const { service, vault_settings_port } = create_setup();
      vault_settings_port.get_vault_setting.mockResolvedValueOnce(null);

      const result = await service.load_tabs();

      expect(result).toBeNull();
    });
  });
});
