import { describe, expect, it, vi } from "vitest";
import { use_keyboard_shortcuts } from "$lib/hooks/use_keyboard_shortcuts.svelte";

describe("use_keyboard_shortcuts", () => {
  it("opens omnibar commands on mod+p when closed", () => {
    const on_open_omnibar_commands = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands,
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "p",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(1);
    expect(stop_propagation).toHaveBeenCalledTimes(1);
    expect(on_open_omnibar_commands).toHaveBeenCalledTimes(1);
  });

  it("closes omnibar on mod+p when already open", () => {
    const on_toggle_omnibar = vi.fn();
    const on_open_omnibar_commands = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => true,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar,
      on_open_omnibar_commands,
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "p",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(on_toggle_omnibar).toHaveBeenCalledTimes(1);
    expect(on_open_omnibar_commands).toHaveBeenCalledTimes(0);
  });

  it("opens omnibar notes on mod+o when closed", () => {
    const on_open_omnibar_notes = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes,
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "o",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(1);
    expect(stop_propagation).toHaveBeenCalledTimes(1);
    expect(on_open_omnibar_notes).toHaveBeenCalledTimes(1);
  });

  it("closes omnibar on mod+o when already open", () => {
    const on_toggle_omnibar = vi.fn();
    const on_open_omnibar_notes = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => true,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar,
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes,
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "o",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(on_toggle_omnibar).toHaveBeenCalledTimes(1);
    expect(on_open_omnibar_notes).toHaveBeenCalledTimes(0);
  });

  it("opens vault switcher on mod+shift+o", () => {
    const on_open_vault_switcher = vi.fn();
    const on_open_omnibar_notes = vi.fn();
    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes,
      on_open_vault_switcher,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: "o",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_open_vault_switcher).toHaveBeenCalledTimes(1);
    expect(on_open_omnibar_notes).not.toHaveBeenCalled();
  });

  it("closes vault switcher on mod+w when open", () => {
    const on_close_vault_switcher = vi.fn();
    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => true,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher,
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "w",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_close_vault_switcher).toHaveBeenCalledTimes(1);
  });

  it("requests save on mod+s (case-insensitive)", () => {
    const on_save = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save,
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      key: "S",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(1);
    expect(stop_propagation).toHaveBeenCalledTimes(1);
    expect(on_save).toHaveBeenCalledTimes(1);
  });

  it("does not bind mod+k", () => {
    const on_open_omnibar_commands = vi.fn();
    const on_toggle_omnibar = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar,
      on_open_omnibar_commands,
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "k",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(0);
    expect(stop_propagation).toHaveBeenCalledTimes(0);
    expect(on_toggle_omnibar).toHaveBeenCalledTimes(0);
    expect(on_open_omnibar_commands).toHaveBeenCalledTimes(0);
  });

  it("blocks sidebar toggle on mod+b when blocked", () => {
    const on_toggle_sidebar = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar,
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "b",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(1);
    expect(stop_propagation).toHaveBeenCalledTimes(1);
    expect(on_toggle_sidebar).toHaveBeenCalledTimes(0);
  });

  it("blocks save on mod+s when blocked", () => {
    const on_save = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save,
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      key: "s",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(1);
    expect(stop_propagation).toHaveBeenCalledTimes(1);
    expect(on_save).toHaveBeenCalledTimes(0);
  });

  it("selects pinned vault slot on mod+1", () => {
    const on_select_pinned_vault = vi.fn();
    const prevent_default = vi.fn();
    const stop_propagation = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault,
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      key: "1",
      preventDefault: prevent_default,
      stopPropagation: stop_propagation,
    } as unknown as KeyboardEvent);

    expect(prevent_default).toHaveBeenCalledTimes(1);
    expect(stop_propagation).toHaveBeenCalledTimes(1);
    expect(on_select_pinned_vault).toHaveBeenCalledWith(0);
  });

  it("blocks pinned vault shortcut while blocked", () => {
    const on_select_pinned_vault = vi.fn();
    const shortcuts = use_keyboard_shortcuts({
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      on_toggle_omnibar: vi.fn(),
      on_open_omnibar_commands: vi.fn(),
      on_open_omnibar_notes: vi.fn(),
      on_open_vault_switcher: vi.fn(),
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault,
      on_toggle_sidebar: vi.fn(),
      on_toggle_find_in_file: vi.fn(),
      on_save: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      key: "2",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_select_pinned_vault).not.toHaveBeenCalled();
  });
});
