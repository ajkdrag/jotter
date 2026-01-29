import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/state/app_state_machine'

export function init_theme(theme_port: ThemePort): ThemeMode {
  return theme_port.get_theme()
}
