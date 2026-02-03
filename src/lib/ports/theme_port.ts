import type { ThemeMode } from '$lib/stores/ui_store'

export interface ThemePort {
  get_theme(): ThemeMode
  set_theme(mode: ThemeMode): void
  get_resolved_theme(): 'light' | 'dark'
}
