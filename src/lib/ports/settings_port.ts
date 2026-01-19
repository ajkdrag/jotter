export interface SettingsPort {
  get_setting<T>(key: string): Promise<T | null>
  set_setting<T>(key: string, value: T): Promise<void>
}

