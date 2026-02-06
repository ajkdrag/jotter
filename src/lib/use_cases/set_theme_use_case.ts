import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/types/theme'
import type { AppEvent } from '$lib/events/app_event'

export function set_theme_use_case(
  ports: { theme: ThemePort },
  args: { theme: ThemeMode }
): AppEvent[] {
  ports.theme.set_theme(args.theme)
  return [{ type: 'ui_theme_set', theme: args.theme }]
}
