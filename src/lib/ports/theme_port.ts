import type { ThemeMode } from '$lib/types/theme'

export interface ThemePort {
  get_theme(): ThemeMode
  set_theme(mode: ThemeMode): void
  get_resolved_theme(): 'light' | 'dark'
}
