import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import type { CommandId } from '$lib/types/command_palette'
import type { EditorSettings } from '$lib/types/editor_settings'
import type { NoteId } from '$lib/types/ids'
import { parse_search_query } from '$lib/utils/search_query_parser'
import { search_palette } from '$lib/utils/search_palette'

function open_command_palette(input: ActionRegistrationInput) {
  const result = search_palette({ query: parse_search_query('') })
  input.stores.ui.command_palette = {
    open: true,
    query: '',
    selected_index: 0,
    commands: result.commands,
    settings: result.settings
  }
}

function close_command_palette(input: ActionRegistrationInput) {
  input.stores.ui.command_palette = {
    ...input.stores.ui.command_palette,
    open: false
  }
}

function open_file_search(input: ActionRegistrationInput) {
  input.stores.ui.file_search = {
    ...input.stores.ui.file_search,
    open: true,
    query: '',
    results: [],
    selected_index: 0,
    is_searching: false
  }
}

function close_file_search(input: ActionRegistrationInput) {
  input.stores.ui.file_search = {
    ...input.stores.ui.file_search,
    open: false,
    query: '',
    results: [],
    selected_index: 0,
    is_searching: false
  }
}

function add_recent_note(input: ActionRegistrationInput, note_id: NoteId) {
  const filtered = input.stores.ui.file_search.recent_note_ids.filter((id) => id !== note_id)
  input.stores.ui.file_search = {
    ...input.stores.ui.file_search,
    recent_note_ids: [note_id, ...filtered].slice(0, 10)
  }
}

export function register_search_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input

  registry.register({
    id: ACTION_IDS.palette_toggle,
    label: 'Toggle Command Palette',
    shortcut: 'CmdOrCtrl+P',
    execute: () => {
      if (stores.ui.command_palette.open) {
        close_command_palette(input)
        return
      }

      open_command_palette(input)
    }
  })

  registry.register({
    id: ACTION_IDS.palette_open,
    label: 'Open Command Palette',
    execute: () => {
      open_command_palette(input)
    }
  })

  registry.register({
    id: ACTION_IDS.palette_close,
    label: 'Close Command Palette',
    execute: () => {
      close_command_palette(input)
    }
  })

  registry.register({
    id: ACTION_IDS.palette_set_query,
    label: 'Set Command Palette Query',
    execute: (query: unknown) => {
      const normalized_query = String(query)
      const result = search_palette({ query: parse_search_query(normalized_query) })
      stores.ui.command_palette = {
        ...stores.ui.command_palette,
        query: normalized_query,
        selected_index: 0,
        commands: result.commands,
        settings: result.settings
      }
    }
  })

  registry.register({
    id: ACTION_IDS.palette_set_selected_index,
    label: 'Set Command Palette Selected Index',
    execute: (index: unknown) => {
      stores.ui.command_palette = {
        ...stores.ui.command_palette,
        selected_index: Number(index)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.palette_select_command,
    label: 'Select Command Palette Command',
    execute: async (command: unknown) => {
      const command_id = command as CommandId
      close_command_palette(input)

      switch (command_id) {
        case 'create_new_note':
          await registry.execute(ACTION_IDS.note_create)
          break
        case 'change_vault':
          await registry.execute(ACTION_IDS.vault_request_change)
          break
        case 'open_settings':
          await registry.execute(ACTION_IDS.settings_open)
          break
        case 'open_file_search':
          await registry.execute(ACTION_IDS.search_open)
          break
      }
    }
  })

  registry.register({
    id: ACTION_IDS.palette_select_setting,
    label: 'Select Command Palette Setting',
    execute: async (key: unknown) => {
      void (key as keyof EditorSettings)
      close_command_palette(input)
      await registry.execute(ACTION_IDS.settings_open)
    }
  })

  registry.register({
    id: ACTION_IDS.search_toggle,
    label: 'Toggle File Search',
    shortcut: 'CmdOrCtrl+O',
    execute: () => {
      if (stores.ui.file_search.open) {
        close_file_search(input)
        return
      }

      open_file_search(input)
    }
  })

  registry.register({
    id: ACTION_IDS.search_open,
    label: 'Open File Search',
    execute: () => {
      open_file_search(input)
    }
  })

  registry.register({
    id: ACTION_IDS.search_close,
    label: 'Close File Search',
    execute: () => {
      close_file_search(input)
    }
  })

  registry.register({
    id: ACTION_IDS.search_set_query,
    label: 'Set File Search Query',
    execute: async (query: unknown) => {
      const normalized_query = String(query)
      const trimmed_query = normalized_query.trim()

      stores.ui.file_search = {
        ...stores.ui.file_search,
        query: normalized_query,
        selected_index: 0
      }

      if (!trimmed_query) {
        stores.ui.file_search = {
          ...stores.ui.file_search,
          results: [],
          is_searching: false
        }
        stores.op.reset('search.notes')
        return
      }

      stores.ui.file_search = {
        ...stores.ui.file_search,
        is_searching: true
      }

      const result = await services.search.search_notes(normalized_query)
      if (stores.ui.file_search.query !== normalized_query) {
        return
      }

      if (result.status === 'success') {
        stores.ui.file_search = {
          ...stores.ui.file_search,
          results: result.results,
          is_searching: false
        }
        return
      }

      if (result.status === 'stale') {
        return
      }

      stores.ui.file_search = {
        ...stores.ui.file_search,
        results: [],
        is_searching: false
      }
    }
  })

  registry.register({
    id: ACTION_IDS.search_set_selected_index,
    label: 'Set File Search Selected Index',
    execute: (index: unknown) => {
      stores.ui.file_search = {
        ...stores.ui.file_search,
        selected_index: Number(index)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.search_confirm_note,
    label: 'Confirm File Search Note',
    execute: async (note_id: unknown) => {
      const selected_note_id = note_id as NoteId
      add_recent_note(input, selected_note_id)
      close_file_search(input)
      await registry.execute(ACTION_IDS.note_open, selected_note_id)
    }
  })
}
