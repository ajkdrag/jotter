import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { EditorSettings } from "$lib/types/editor_settings";
import type {
  SettingsLoadResult,
  SettingsSaveResult,
} from "$lib/types/settings_service_result";
import { SETTINGS_KEY } from "$lib/types/editor_settings";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("settings_service");

const GLOBAL_SHOW_DASHBOARD_ON_OPEN_KEY = "show_vault_dashboard_on_open";

function sanitize_vault_scoped_settings(value: unknown): {
  settings: EditorSettings | null;
  had_global_dashboard_flag: boolean;
} {
  if (!value || typeof value !== "object") {
    return { settings: null, had_global_dashboard_flag: false };
  }
  const record = value as Record<string, unknown>;
  const had_global_dashboard_flag = Object.prototype.hasOwnProperty.call(
    record,
    "show_vault_dashboard_on_open",
  );
  if (had_global_dashboard_flag) {
    delete record.show_vault_dashboard_on_open;
  }
  return {
    settings: record as EditorSettings,
    had_global_dashboard_flag,
  };
}

export class SettingsService {
  constructor(
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly settings_port: SettingsPort,
    private readonly vault_store: VaultStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  private async load_global_show_dashboard_on_open(
    fallback: boolean,
  ): Promise<boolean> {
    const global_value = await this.settings_port.get_setting<unknown>(
      GLOBAL_SHOW_DASHBOARD_ON_OPEN_KEY,
    );
    if (typeof global_value === "boolean") {
      return global_value;
    }
    return fallback;
  }

  async load_settings(
    current_settings: EditorSettings,
  ): Promise<SettingsLoadResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return {
        status: "skipped",
        settings: current_settings,
      };
    }

    this.op_store.start("settings.load", this.now_ms());

    try {
      const stored_raw =
        await this.vault_settings_port.get_vault_setting<unknown>(
          vault_id,
          SETTINGS_KEY,
        );
      const { settings: stored, had_global_dashboard_flag } =
        sanitize_vault_scoped_settings(stored_raw);
      const merged = stored
        ? { ...current_settings, ...stored }
        : { ...current_settings };
      const settings = {
        ...merged,
        show_vault_dashboard_on_open:
          await this.load_global_show_dashboard_on_open(
            merged.show_vault_dashboard_on_open,
          ),
      };
      if (stored && had_global_dashboard_flag) {
        await this.vault_settings_port.set_vault_setting(
          vault_id,
          SETTINGS_KEY,
          stored,
        );
      }
      this.op_store.succeed("settings.load");
      return {
        status: "success",
        settings,
      };
    } catch (error) {
      const message = error_message(error);
      log.error("Load settings failed", { error: message });
      this.op_store.fail("settings.load", message);
      return {
        status: "failed",
        settings: current_settings,
        error: message,
      };
    }
  }

  async save_settings(settings: EditorSettings): Promise<SettingsSaveResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    this.op_store.start("settings.save", this.now_ms());

    try {
      const { show_vault_dashboard_on_open, ...vault_scoped_settings } =
        settings;
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        SETTINGS_KEY,
        vault_scoped_settings,
      );
      await this.settings_port.set_setting(
        GLOBAL_SHOW_DASHBOARD_ON_OPEN_KEY,
        show_vault_dashboard_on_open,
      );
      this.op_store.succeed("settings.save");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      log.error("Save settings failed", { error: message });
      this.op_store.fail("settings.save", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  reset_load_operation() {
    this.op_store.reset("settings.load");
  }

  reset_save_operation() {
    this.op_store.reset("settings.save");
  }
}
