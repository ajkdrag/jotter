import type { SettingsPort } from "$lib/ports/settings_port";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { Theme } from "$lib/types/theme";
import {
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  create_user_theme,
} from "$lib/types/theme";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("theme_service");

const THEMES_KEY = "user_themes";
const ACTIVE_THEME_ID_KEY = "active_theme_id";

export type ThemeLoadResult = {
  user_themes: Theme[];
  active_theme_id: string;
};

export class ThemeService {
  constructor(
    private readonly settings_port: SettingsPort,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  async load_themes(): Promise<ThemeLoadResult> {
    this.op_store.start("theme.load", this.now_ms());
    try {
      const [stored_themes, stored_id] = await Promise.all([
        this.settings_port.get_setting<unknown>(THEMES_KEY),
        this.settings_port.get_setting<unknown>(ACTIVE_THEME_ID_KEY),
      ]);

      const user_themes = parse_stored_themes(stored_themes);
      const active_theme_id =
        typeof stored_id === "string" ? stored_id : DEFAULT_THEME_ID;

      this.op_store.succeed("theme.load");
      return { user_themes, active_theme_id };
    } catch (error) {
      const msg = error_message(error);
      log.error("Load themes failed", { error: msg });
      this.op_store.fail("theme.load", msg);
      return { user_themes: [], active_theme_id: DEFAULT_THEME_ID };
    }
  }

  async save_user_themes(themes: Theme[]): Promise<void> {
    try {
      const serializable = themes.filter((t) => !t.is_builtin);
      await this.settings_port.set_setting(THEMES_KEY, serializable);
    } catch (error) {
      log.error("Save themes failed", { error: error_message(error) });
    }
  }

  async save_active_theme_id(id: string): Promise<void> {
    try {
      await this.settings_port.set_setting(ACTIVE_THEME_ID_KEY, id);
    } catch (error) {
      log.error("Save active theme ID failed", {
        error: error_message(error),
      });
    }
  }

  duplicate_theme(name: string, base: Theme): Theme {
    return create_user_theme(name, base);
  }

  is_valid_theme_id(id: string, user_themes: Theme[]): boolean {
    if (BUILTIN_THEMES.some((t) => t.id === id)) return true;
    return user_themes.some((t) => t.id === id);
  }
}

function parse_stored_themes(raw: unknown): Theme[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((entry): entry is Theme => {
    if (typeof entry !== "object" || entry === null) return false;
    const t = entry as Record<string, unknown>;
    return (
      typeof t.id === "string" &&
      typeof t.name === "string" &&
      (t.color_scheme === "dark" || t.color_scheme === "light") &&
      typeof t.accent_hue === "number"
    );
  });
}
