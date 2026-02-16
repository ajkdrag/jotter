import type { SettingsPort } from "$lib/ports/settings_port";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type {
  HotkeyBinding,
  HotkeyConfig,
  HotkeyConflict,
  HotkeyOverride,
  HotkeyPhase,
} from "$lib/types/hotkey_config";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("hotkey_service");

const HOTKEY_OVERRIDES_KEY = "hotkey_overrides";

export class HotkeyService {
  constructor(
    private readonly settings_port: SettingsPort,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  async load_hotkey_overrides(): Promise<HotkeyOverride[]> {
    try {
      const stored =
        await this.settings_port.get_setting<unknown>(HOTKEY_OVERRIDES_KEY);
      if (!stored || !Array.isArray(stored)) return [];
      return stored.filter((entry): entry is HotkeyOverride => {
        if (typeof entry !== "object" || entry === null) return false;
        if (!("action_id" in entry)) return false;
        const candidate = entry as Record<string, unknown>;
        if (typeof candidate.action_id !== "string") return false;
        if (!("key" in entry)) return false;
        return typeof candidate.key === "string" || candidate.key === null;
      });
    } catch (error) {
      log.error("Load hotkey overrides failed", {
        error: error_message(error),
      });
      return [];
    }
  }

  async save_hotkey_overrides(overrides: HotkeyOverride[]): Promise<void> {
    try {
      await this.settings_port.set_setting(HOTKEY_OVERRIDES_KEY, overrides);
    } catch (error) {
      log.error("Save hotkey overrides failed", {
        error: error_message(error),
      });
    }
  }

  merge_config(
    defaults: HotkeyBinding[],
    overrides: HotkeyOverride[],
  ): HotkeyConfig {
    const override_map = new Map<string, HotkeyOverride>();
    for (const override of overrides) {
      override_map.set(override.action_id, override);
    }

    const bindings: HotkeyBinding[] = [];
    for (const binding of defaults) {
      const override = override_map.get(binding.action_id);
      if (override) {
        bindings.push({ ...binding, key: override.key });
      } else {
        bindings.push(binding);
      }
    }

    return { bindings };
  }

  detect_conflict(
    key: string,
    phase: HotkeyPhase,
    exclude_action_id: string,
    config: HotkeyConfig,
  ): HotkeyConflict | null {
    for (const binding of config.bindings) {
      if (
        binding.key === key &&
        binding.phase === phase &&
        binding.action_id !== exclude_action_id
      ) {
        return {
          key,
          existing_action_id: binding.action_id,
          existing_label: binding.label,
        };
      }
    }
    return null;
  }
}
