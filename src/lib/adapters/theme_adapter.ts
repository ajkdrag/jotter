import { Theme } from 'svelte-themes'
import type { ThemePort } from '$lib/ports/theme_port'
import type { ThemeMode } from '$lib/state/app_state_machine'

export function create_theme_adapter(): ThemePort {
  const theme = new Theme({
    themes: ['light', 'dark', 'system'],
    defaultTheme: 'system',
    storageKey: 'imdown_theme',
    enableSystem: true,
    attribute: 'class'
  })

  return {
    get_theme(): ThemeMode {
      return theme.theme as ThemeMode
    },

    set_theme(mode: ThemeMode): void {
      theme.theme = mode
    },

    get_resolved_theme(): 'light' | 'dark' {
      return theme.resolvedTheme as 'light' | 'dark'
    }
  }
}
