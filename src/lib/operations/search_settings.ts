import { SETTINGS_REGISTRY, type SettingDefinition } from '$lib/types/settings_registry'
export type { SettingDefinition } from '$lib/types/settings_registry'

export function search_settings(query: string): SettingDefinition[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  return SETTINGS_REGISTRY.filter((setting) => {
    const searchable = [
      setting.label,
      setting.description,
      setting.category,
      ...setting.keywords
    ]
      .join(' ')
      .toLowerCase()

    return searchable.includes(q)
  })
}
