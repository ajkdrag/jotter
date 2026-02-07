import type { CommandDefinition } from '$lib/types/command_palette'

export type {
  CommandId,
  CommandIcon,
  CommandDefinition
} from '$lib/types/command_palette'

export const COMMANDS_REGISTRY: CommandDefinition[] = [
  {
    id: 'create_new_note',
    label: 'Create new note',
    description: 'Create an untitled note in the current folder',
    keywords: ['new', 'add', 'create', 'note', 'file', 'document'],
    icon: 'file-plus'
  },
  {
    id: 'change_vault',
    label: 'Change vault',
    description: 'Switch to a different vault',
    keywords: ['switch', 'vault', 'folder', 'workspace', 'change', 'open'],
    icon: 'folder-open'
  },
  {
    id: 'open_settings',
    label: 'Settings',
    description: 'Open application settings',
    keywords: ['settings', 'preferences', 'config', 'options', 'configure'],
    icon: 'settings'
  },
  {
    id: 'open_file_search',
    label: 'Search files',
    description: 'Open file search (Cmd+O)',
    keywords: ['search', 'find', 'file', 'open', 'quick', 'navigate'],
    icon: 'search'
  }
]

export function search_commands(query: string): CommandDefinition[] {
  const q = query.toLowerCase().trim()
  if (!q) return COMMANDS_REGISTRY

  return COMMANDS_REGISTRY.filter((cmd) => {
    const searchable = [cmd.label, cmd.description, ...cmd.keywords].join(' ').toLowerCase()
    return searchable.includes(q)
  })
}
