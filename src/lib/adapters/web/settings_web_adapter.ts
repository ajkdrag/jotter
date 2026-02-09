import type { SettingsPort } from "$lib/ports/settings_port";
import { logger } from "$lib/utils/logger";

const SETTINGS_PREFIX = "jotter_settings_";

export function create_settings_web_adapter(): SettingsPort {
  return {
    get_setting<T>(key: string): Promise<T | null> {
      try {
        const value = localStorage.getItem(`${SETTINGS_PREFIX}${key}`);
        return Promise.resolve(value ? JSON.parse(value) : null);
      } catch (e) {
        logger.from_error(`Failed to parse setting "${key}"`, e);
        return Promise.resolve(null);
      }
    },

    set_setting(key: string, value: unknown): Promise<void> {
      try {
        localStorage.setItem(`${SETTINGS_PREFIX}${key}`, JSON.stringify(value));
      } catch (e) {
        logger.from_error(`Failed to save setting "${key}"`, e);
      }
      return Promise.resolve();
    },
  };
}
