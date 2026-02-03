export type KeyboardShortcuts = {
  handle_keydown_capture: (event: KeyboardEvent) => void
  handle_keydown: (event: KeyboardEvent) => void
}

export function use_keyboard_shortcuts(input: {
  is_enabled: () => boolean
  on_toggle_palette: () => void
  on_toggle_file_search: () => void
  on_toggle_sidebar: () => void
  on_save: () => void
}): KeyboardShortcuts {
  const { is_enabled, on_toggle_palette, on_toggle_file_search, on_toggle_sidebar, on_save } = input

  const is_mod_combo = (event: KeyboardEvent, key: string): boolean => {
    if (!(event.metaKey || event.ctrlKey)) return false
    return event.key.toLowerCase() === key
  }

  const handle_keydown_capture = (event: KeyboardEvent) => {
    if (is_mod_combo(event, 'p')) {
      if (!is_enabled()) return
      event.preventDefault()
      on_toggle_palette()
      return
    }

    if (is_mod_combo(event, 'o')) {
      if (!is_enabled()) return
      event.preventDefault()
      on_toggle_file_search()
      return
    }

    if (is_mod_combo(event, 'b')) {
      if (!is_enabled()) return
      event.preventDefault()
      on_toggle_sidebar()
    }
  }

  const handle_keydown = (event: KeyboardEvent) => {
    if (!is_mod_combo(event, 's')) return
    event.preventDefault()
    on_save()
  }

  return {
    handle_keydown_capture,
    handle_keydown
  }
}
