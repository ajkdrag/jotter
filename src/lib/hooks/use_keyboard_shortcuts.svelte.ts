export type KeyboardShortcuts = {
  handle_keydown_capture: (event: KeyboardEvent) => void
  handle_keydown: (event: KeyboardEvent) => void
}

export function use_keyboard_shortcuts(input: {
  is_enabled: () => boolean
  is_blocked: () => boolean
  is_omnibar_open: () => boolean
  on_toggle_omnibar: () => void
  on_open_omnibar_commands: () => void
  on_open_omnibar_notes: () => void
  on_toggle_sidebar: () => void
  on_save: () => void
}): KeyboardShortcuts {
  const {
    is_enabled,
    is_blocked,
    is_omnibar_open,
    on_toggle_omnibar,
    on_open_omnibar_commands,
    on_open_omnibar_notes,
    on_toggle_sidebar,
    on_save
  } = input

  const is_mod_combo = (event: KeyboardEvent, key: string): boolean => {
    if (!(event.metaKey || event.ctrlKey)) return false
    return event.key.toLowerCase() === key
  }

  const handle_keydown_capture = (event: KeyboardEvent) => {
    if (is_mod_combo(event, 'k')) {
      if (!is_enabled()) return
      event.preventDefault()
      event.stopPropagation()
      if (is_blocked() && !is_omnibar_open()) return
      on_toggle_omnibar()
      return
    }

    if (is_mod_combo(event, 'p')) {
      if (!is_enabled()) return
      event.preventDefault()
      event.stopPropagation()
      if (is_blocked() && !is_omnibar_open()) return
      if (is_omnibar_open()) {
        on_toggle_omnibar()
      } else {
        on_open_omnibar_commands()
      }
      return
    }

    if (is_mod_combo(event, 'o')) {
      if (!is_enabled()) return
      event.preventDefault()
      event.stopPropagation()
      if (is_blocked() && !is_omnibar_open()) return
      if (is_omnibar_open()) {
        on_toggle_omnibar()
      } else {
        on_open_omnibar_notes()
      }
      return
    }

    if (is_mod_combo(event, 'b')) {
      if (!is_enabled()) return
      event.preventDefault()
      event.stopPropagation()
      if (is_blocked()) return
      on_toggle_sidebar()
    }
  }

  const handle_keydown = (event: KeyboardEvent) => {
    if (!is_mod_combo(event, 's')) return
    if (!is_enabled()) return
    event.preventDefault()
    event.stopPropagation()
    if (is_blocked()) return
    on_save()
  }

  return {
    handle_keydown_capture,
    handle_keydown
  }
}
