import type { ThemeMode } from '$lib/state/app_state_machine'

export interface ThemePort {
  get_theme(): ThemeMode
  set_theme(mode: ThemeMode): void
  get_resolved_theme(): 'light' | 'dark'
}
