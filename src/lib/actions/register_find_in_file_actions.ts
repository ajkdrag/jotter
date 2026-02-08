import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'

export function register_find_in_file_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input

  registry.register({
    id: ACTION_IDS.find_in_file_toggle,
    label: 'Toggle Find in File',
    shortcut: 'CmdOrCtrl+F',
    execute: () => {
      stores.ui.find_in_file = {
        ...stores.ui.find_in_file,
        open: !stores.ui.find_in_file.open
      }
      if (!stores.ui.find_in_file.open) {
        stores.search.clear_in_file_matches()
      }
    }
  })

  registry.register({
    id: ACTION_IDS.find_in_file_open,
    label: 'Open Find in File',
    execute: () => {
      stores.ui.find_in_file = { ...stores.ui.find_in_file, open: true }
    }
  })

  registry.register({
    id: ACTION_IDS.find_in_file_close,
    label: 'Close Find in File',
    execute: () => {
      stores.ui.find_in_file = { open: false, query: '', selected_match_index: 0 }
      stores.search.clear_in_file_matches()
    }
  })

  registry.register({
    id: ACTION_IDS.find_in_file_set_query,
    label: 'Set Find in File Query',
    execute: (query: unknown) => {
      const q = String(query)
      stores.ui.find_in_file = { ...stores.ui.find_in_file, query: q, selected_match_index: 0 }
      const markdown = stores.editor.open_note?.markdown ?? ''
      const matches = services.search.search_within_file(markdown, q)
      stores.search.set_in_file_matches(matches)
    }
  })

  registry.register({
    id: ACTION_IDS.find_in_file_next,
    label: 'Find Next',
    shortcut: 'CmdOrCtrl+G',
    execute: () => {
      const total = stores.search.in_file_matches.length
      if (total === 0) return
      stores.ui.find_in_file = {
        ...stores.ui.find_in_file,
        selected_match_index: (stores.ui.find_in_file.selected_match_index + 1) % total
      }
    }
  })

  registry.register({
    id: ACTION_IDS.find_in_file_prev,
    label: 'Find Previous',
    shortcut: 'Shift+CmdOrCtrl+G',
    execute: () => {
      const total = stores.search.in_file_matches.length
      if (total === 0) return
      stores.ui.find_in_file = {
        ...stores.ui.find_in_file,
        selected_match_index:
          (stores.ui.find_in_file.selected_match_index - 1 + total) % total
      }
    }
  })
}
