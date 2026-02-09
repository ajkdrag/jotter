import { mode, setMode, userPrefersMode } from "mode-watcher";
import type { ThemePort } from "$lib/ports/theme_port";
import type { ThemeMode } from "$lib/types/theme";

export function create_theme_adapter(): ThemePort {
  return {
    get_theme(): ThemeMode {
      return userPrefersMode.current as ThemeMode;
    },

    set_theme(mode: ThemeMode): void {
      setMode(mode);
    },

    get_resolved_theme(): "light" | "dark" {
      return mode.current ?? "light";
    },
  };
}
