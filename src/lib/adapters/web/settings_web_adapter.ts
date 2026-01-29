import type { SettingsPort } from '$lib/ports/settings_port'

const SETTINGS_PREFIX = 'imdown_settings_'

export function create_settings_web_adapter(): SettingsPort {
  return {
    async get_setting<T>(key: string): Promise<T | null> {
      try {
        const value = localStorage.getItem(`${SETTINGS_PREFIX}${key}`)
        return value ? JSON.parse(value) : null
      } catch {
        return null
      }
    },

    async set_setting<T>(key: string, value: T): Promise<void> {
      try {
        localStorage.setItem(`${SETTINGS_PREFIX}${key}`, JSON.stringify(value))
      } catch {
        // Ignore errors
      }
    }
  }
}
