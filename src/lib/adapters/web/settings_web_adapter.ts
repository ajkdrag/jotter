import type { SettingsPort } from '$lib/ports/settings_port'

const SETTINGS_PREFIX = 'imdown_settings_'

export function create_settings_web_adapter(): SettingsPort {
  return {
    get_setting<T>(key: string): Promise<T | null> {
      try {
        const value = localStorage.getItem(`${SETTINGS_PREFIX}${key}`)
        return Promise.resolve(value ? JSON.parse(value) : null)
      } catch {
        return Promise.resolve(null)
      }
    },

    set_setting(key: string, value: unknown): Promise<void> {
      try {
        localStorage.setItem(`${SETTINGS_PREFIX}${key}`, JSON.stringify(value))
      } catch {
        // Ignore errors
      }
      return Promise.resolve()
    }
  }
}
