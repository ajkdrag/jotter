import type { SettingsPort } from "$lib/ports/settings_port";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("settings_web_adapter");

const SETTINGS_PREFIX = "jotter_settings_";

export function create_settings_web_adapter(): SettingsPort {
  return {
    get_setting<T>(key: string): Promise<T | null> {
      try {
        const value = localStorage.getItem(`${SETTINGS_PREFIX}${key}`);
        return Promise.resolve(value ? JSON.parse(value) : null);
      } catch (e) {
        log.error("Failed to parse setting", { key, error: e });
        return Promise.resolve(null);
      }
    },

    set_setting(key: string, value: unknown): Promise<void> {
      try {
        localStorage.setItem(`${SETTINGS_PREFIX}${key}`, JSON.stringify(value));
      } catch (e) {
        log.error("Failed to save setting", { key, error: e });
      }
      return Promise.resolve();
    },
  };
}
