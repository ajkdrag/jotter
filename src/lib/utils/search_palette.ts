import type { SearchQuery } from '$lib/types/search'
import { COMMANDS_REGISTRY, type CommandDefinition } from '$lib/utils/search_commands'
import { SETTINGS_REGISTRY, type SettingDefinition } from '$lib/types/settings_registry'

type PaletteSearchResult = {
  commands: CommandDefinition[]
  settings: SettingDefinition[]
}

function score_command(query: string, command: CommandDefinition): number {
  const label = command.label.toLowerCase()
  if (label.startsWith(query)) return 100
  if (label.includes(query)) return 80
  if (command.keywords.some((k) => k.toLowerCase().includes(query))) return 60
  if (command.description.toLowerCase().includes(query)) return 40
  return 0
}

function score_setting(query: string, setting: SettingDefinition): number {
  const label = setting.label.toLowerCase()
  if (label.startsWith(query)) return 100
  if (label.includes(query)) return 80
  if (setting.keywords.some((k) => k.toLowerCase().includes(query))) return 60
  if (setting.description.toLowerCase().includes(query)) return 40
  if (setting.category.toLowerCase().includes(query)) return 20
  return 0
}

export function search_palette(args: { query: SearchQuery }): PaletteSearchResult {
  const q = args.query.text.toLowerCase().trim()
  if (!q) {
    return { commands: COMMANDS_REGISTRY, settings: [] }
  }

  const commands = COMMANDS_REGISTRY
    .map((command) => ({ command, score: score_command(q, command) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.command)

  const settings = SETTINGS_REGISTRY
    .map((setting) => ({ setting, score: score_setting(q, setting) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.setting)

  return { commands, settings }
}
