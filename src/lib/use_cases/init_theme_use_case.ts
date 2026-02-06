import type { ThemePort } from '$lib/ports/theme_port'
import type { AppEvent } from '$lib/events/app_event'
import { init_theme } from '$lib/operations/init_theme'

export function init_theme_use_case(ports: { theme: ThemePort }): AppEvent[] {
  const theme_mode = init_theme(ports.theme)
  return [{ type: 'ui_theme_set', theme: theme_mode }]
}
