import type { NoteMeta } from '$lib/types/note'
import type { CommandDefinition } from '$lib/types/command_palette'
import type { SettingDefinition } from '$lib/types/settings_registry'

export type SearchScope = 'all' | 'path' | 'title' | 'content'
export type SearchDomain = 'notes' | 'commands'

export type SearchQuery = {
  raw: string
  text: string
  scope: SearchScope
  domain: SearchDomain
}

export type NoteSearchHit = {
  note: NoteMeta
  score: number
  snippet?: string | undefined
}

export type WikiSuggestion = {
  note: NoteMeta
  score: number
}

export type InFileMatch = {
  line: number
  column: number
  length: number
  context: string
}

export type OmnibarItem =
  | { kind: 'note'; note: NoteMeta; score: number; snippet?: string | undefined }
  | { kind: 'command'; command: CommandDefinition; score: number }
  | { kind: 'setting'; setting: SettingDefinition; score: number }
  | { kind: 'recent_note'; note: NoteMeta }
