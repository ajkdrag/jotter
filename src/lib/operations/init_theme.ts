import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/types/theme'

export function init_theme(theme_port: ThemePort): ThemeMode {
  return theme_port.get_theme()
}
