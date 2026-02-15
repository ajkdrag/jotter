import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "$lib/services/settings_service";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { as_vault_id } from "$lib/types/ids";
import { create_test_vault } from "../helpers/test_fixtures";

describe("SettingsService", () => {
  it("loads show_vault_dashboard_on_open from global settings", async () => {
    const vault_settings_port = {
      get_vault_setting: vi.fn().mockResolvedValue({ autosave_enabled: true }),
      set_vault_setting: vi.fn(),
    };
    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(false),
      set_setting: vi.fn(),
    };
    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault({ id: as_vault_id("vault-a") }));
    const op_store = new OpStore();
    const service = new SettingsService(
      vault_settings_port as never,
      settings_port as never,
      vault_store,
      op_store,
      () => 1,
    );

    const result = await service.load_settings({
      font_size: 1,
      line_height: 1.75,
      heading_color: "inherit",
      spacing: "normal",
      link_syntax: "wikilink",
      attachment_folder: ".assets",
      show_hidden_files: false,
      autosave_enabled: true,
      git_autocommit_enabled: false,
      show_vault_dashboard_on_open: true,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("expected success");
    }
    expect(result.settings.show_vault_dashboard_on_open).toBe(false);
  });

  it("saves show_vault_dashboard_on_open to global settings only", async () => {
    const vault_settings_port = {
      get_vault_setting: vi.fn().mockResolvedValue(null),
      set_vault_setting: vi.fn().mockResolvedValue(undefined),
    };
    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(null),
      set_setting: vi.fn().mockResolvedValue(undefined),
    };
    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault({ id: as_vault_id("vault-a") }));
    const op_store = new OpStore();
    const service = new SettingsService(
      vault_settings_port as never,
      settings_port as never,
      vault_store,
      op_store,
      () => 1,
    );

    const settings = {
      font_size: 1,
      line_height: 1.75,
      heading_color: "inherit" as const,
      spacing: "normal" as const,
      link_syntax: "wikilink" as const,
      attachment_folder: ".assets",
      show_hidden_files: false,
      autosave_enabled: true,
      git_autocommit_enabled: false,
      show_vault_dashboard_on_open: false,
    };

    const result = await service.save_settings(settings);
    const { show_vault_dashboard_on_open: _, ...vault_scoped_settings } =
      settings;

    expect(result.status).toBe("success");
    expect(vault_settings_port.set_vault_setting).toHaveBeenCalledWith(
      as_vault_id("vault-a"),
      "editor",
      vault_scoped_settings,
    );
    expect(settings_port.set_setting).toHaveBeenCalledWith(
      "show_vault_dashboard_on_open",
      false,
    );
  });

  it("sanitizes stale per-vault dashboard flag during load", async () => {
    const vault_settings_port = {
      get_vault_setting: vi.fn().mockResolvedValue({
        autosave_enabled: true,
        show_vault_dashboard_on_open: true,
      }),
      set_vault_setting: vi.fn().mockResolvedValue(undefined),
    };
    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(false),
      set_setting: vi.fn(),
    };
    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault({ id: as_vault_id("vault-a") }));
    const op_store = new OpStore();
    const service = new SettingsService(
      vault_settings_port as never,
      settings_port as never,
      vault_store,
      op_store,
      () => 1,
    );

    const result = await service.load_settings({
      font_size: 1,
      line_height: 1.75,
      heading_color: "inherit",
      spacing: "normal",
      link_syntax: "wikilink",
      attachment_folder: ".assets",
      show_hidden_files: false,
      autosave_enabled: true,
      git_autocommit_enabled: false,
      show_vault_dashboard_on_open: true,
    });

    expect(result.status).toBe("success");
    expect(vault_settings_port.set_vault_setting).toHaveBeenCalledWith(
      as_vault_id("vault-a"),
      "editor",
      {
        autosave_enabled: true,
      },
    );
  });
});
