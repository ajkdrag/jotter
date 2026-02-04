import { describe, expect, it, vi } from 'vitest'
import { use_keyboard_shortcuts } from '$lib/hooks/use_keyboard_shortcuts.svelte'

describe('use_keyboard_shortcuts', () => {
  it('toggles palette on mod+p when enabled', () => {
    const on_toggle_palette = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette,
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'p',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_toggle_palette).toHaveBeenCalledTimes(1)
  })

  it('does not toggle palette on mod+p when disabled', () => {
    const on_toggle_palette = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => false,
      is_blocked: () => false,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette,
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'p',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(0)
    expect(stop_propagation).toHaveBeenCalledTimes(0)
    expect(on_toggle_palette).toHaveBeenCalledTimes(0)
  })

  it('toggles file search on mod+o when enabled', () => {
    const on_toggle_file_search = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette: vi.fn(),
      on_toggle_file_search,
      on_toggle_sidebar: vi.fn(),
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'o',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_toggle_file_search).toHaveBeenCalledTimes(1)
  })

  it('requests save on mod+s (case-insensitive)', () => {
    const on_save = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette: vi.fn(),
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_save
    })

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      key: 'S',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_save).toHaveBeenCalledTimes(1)
  })

  it('blocks palette toggle on mod+p when blocked and palette is closed', () => {
    const on_toggle_palette = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette,
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'p',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_toggle_palette).toHaveBeenCalledTimes(0)
  })

  it('allows palette toggle on mod+p when blocked and palette is open', () => {
    const on_toggle_palette = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_palette_open: () => true,
      is_file_search_open: () => false,
      on_toggle_palette,
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'p',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_toggle_palette).toHaveBeenCalledTimes(1)
  })

  it('blocks file search toggle on mod+o when blocked and file search is closed', () => {
    const on_toggle_file_search = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette: vi.fn(),
      on_toggle_file_search,
      on_toggle_sidebar: vi.fn(),
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'o',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_toggle_file_search).toHaveBeenCalledTimes(0)
  })

  it('blocks sidebar toggle on mod+b when blocked', () => {
    const on_toggle_sidebar = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette: vi.fn(),
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar,
      on_save: vi.fn()
    })

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: 'b',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_toggle_sidebar).toHaveBeenCalledTimes(0)
  })

  it('blocks save on mod+s when blocked', () => {
    const on_save = vi.fn()
    const prevent_default = vi.fn()
    const stop_propagation = vi.fn()

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_palette_open: () => false,
      is_file_search_open: () => false,
      on_toggle_palette: vi.fn(),
      on_toggle_file_search: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_save
    })

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      key: 's',
      preventDefault: prevent_default,
      stopPropagation: stop_propagation
    } as unknown as KeyboardEvent)

    expect(prevent_default).toHaveBeenCalledTimes(1)
    expect(stop_propagation).toHaveBeenCalledTimes(1)
    expect(on_save).toHaveBeenCalledTimes(0)
  })
})
