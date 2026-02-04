export interface SettingsPort {
  get_setting<T>(key: string): Promise<T | null>
  set_setting(key: string, value: unknown): Promise<void>
}

