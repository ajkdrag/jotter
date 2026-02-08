import type { CommandDefinition } from '$lib/types/command_palette'

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
]
