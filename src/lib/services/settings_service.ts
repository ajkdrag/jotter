import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { EditorSettings } from "$lib/types/editor_settings";
import type {
  SettingsLoadResult,
  SettingsSaveResult,
} from "$lib/types/settings_service_result";
import {
  SETTINGS_KEY,
  GLOBAL_ONLY_SETTING_KEYS,
  omit_global_only_keys,
  apply_global_only_overrides,
} from "$lib/types/editor_settings";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("settings_service");

const RECENT_COMMAND_IDS_KEY = "recent_command_ids";

function sanitize_vault_scoped_settings(value: unknown): {
  settings: Record<string, unknown> | null;
  had_global_keys: boolean;
} {
  if (!value || typeof value !== "object") {
    return { settings: null, had_global_keys: false };
  }
  const record = value as Record<string, unknown>;
  const cleaned = omit_global_only_keys(record);
  const had_global_keys =
    Object.keys(cleaned).length < Object.keys(record).length;
  return { settings: cleaned, had_global_keys };
}

export class SettingsService {
  constructor(
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly settings_port: SettingsPort,
    private readonly vault_store: VaultStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

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
      const { settings: stored, had_global_keys } =
        sanitize_vault_scoped_settings(stored_raw);
      const merged = stored
        ? { ...current_settings, ...stored }
        : { ...current_settings };
      const get_setting = (k: string) =>
        this.settings_port.get_setting<unknown>(k);
      const settings = await apply_global_only_overrides(merged, get_setting);
      if (stored && had_global_keys) {
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
      const vault_scoped = omit_global_only_keys(
        settings as unknown as Record<string, unknown>,
      );
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        SETTINGS_KEY,
        vault_scoped,
      );
      for (const key of GLOBAL_ONLY_SETTING_KEYS) {
        await this.settings_port.set_setting(key, settings[key]);
      }
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

  async load_recent_command_ids(): Promise<string[]> {
    try {
      const stored = await this.settings_port.get_setting<unknown>(
        RECENT_COMMAND_IDS_KEY,
      );
      if (!stored || !Array.isArray(stored)) return [];
      return stored.filter(
        (entry): entry is string => typeof entry === "string",
      );
    } catch (error) {
      log.error("Load recent command IDs failed", {
        error: error_message(error),
      });
      return [];
    }
  }

  async save_recent_command_ids(ids: string[]): Promise<void> {
    try {
      await this.settings_port.set_setting(RECENT_COMMAND_IDS_KEY, ids);
    } catch (error) {
      log.error("Save recent command IDs failed", {
        error: error_message(error),
      });
    }
  }

  reset_load_operation() {
    this.op_store.reset("settings.load");
  }

  reset_save_operation() {
    this.op_store.reset("settings.save");
  }
}
