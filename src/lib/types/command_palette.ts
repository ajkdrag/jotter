export type CommandId = 'create_new_note' | 'change_vault' | 'open_settings' | 'open_file_search'

export type CommandIcon = 'file-plus' | 'folder-open' | 'settings' | 'search'

export type CommandDefinition = {
  id: CommandId
  label: string
  description: string
  keywords: string[]
  icon: CommandIcon
}
