import { describe, it, expect } from 'vitest'
import { init_theme } from '$lib/utils/init_theme'
import type { ThemePort } from '$lib/ports/theme_port'

describe('init_theme', () => {
  it('returns current theme from port', () => {
    const theme_port: ThemePort = {
      get_theme: () => 'dark',
      set_theme: () => {},
      get_resolved_theme: () => 'dark'
    }

    expect(init_theme(theme_port)).toBe('dark')
  })
})
