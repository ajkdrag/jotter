import { describe, expect, it, vi } from "vitest";
import { use_keyboard_shortcuts } from "$lib/hooks/use_keyboard_shortcuts.svelte";
import { DEFAULT_HOTKEYS } from "$lib/domain/default_hotkeys";
import type { ActionRegistry } from "$lib/actions/registry";
import type { HotkeyConfig } from "$lib/types/hotkey_config";

function create_mock_registry() {
  const execute_fn = vi.fn();
  return {
    registry: { execute: execute_fn } as unknown as ActionRegistry,
    execute: execute_fn,
  };
}

const default_config: HotkeyConfig = {
  bindings: DEFAULT_HOTKEYS,
};

describe("use_keyboard_shortcuts", () => {
  it("executes action on registered hotkey", () => {
    const { registry, execute } = create_mock_registry();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "p",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).toHaveBeenCalled();
  });

  it("does not execute when disabled", () => {
    const { registry, execute } = create_mock_registry();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => false,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "p",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).not.toHaveBeenCalled();
  });

  it("does not execute when blocked", () => {
    const { registry, execute } = create_mock_registry();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "p",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).not.toHaveBeenCalled();
  });

  it("closes vault switcher on mod+w when open", () => {
    const { registry, execute } = create_mock_registry();
    const on_close_vault_switcher = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => true,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher,
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "w",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_close_vault_switcher).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("switches to tab on number slot when tabs exist", () => {
    const { registry } = create_mock_registry();
    const on_switch_to_tab = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => true,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab,
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "1",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_switch_to_tab).toHaveBeenCalledWith(0);
  });

  it("selects pinned vault on number slot when no tabs", () => {
    const { registry } = create_mock_registry();
    const on_select_pinned_vault = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault,
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "1",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_select_pinned_vault).toHaveBeenCalledWith(0);
  });

  it("handles bubble phase hotkeys", () => {
    const { registry, execute } = create_mock_registry();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      key: "s",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).toHaveBeenCalled();
  });

  it("does not execute bubble phase when blocked", () => {
    const { registry, execute } = create_mock_registry();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      key: "s",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).not.toHaveBeenCalled();
  });

  it("uses custom hotkey config when provided", () => {
    const { registry, execute } = create_mock_registry();
    const custom_config: HotkeyConfig = {
      bindings: [
        {
          action_id: "test.action",
          key: "CmdOrCtrl+Y",
          phase: "capture",
          label: "Test Action",
          description: "Test",
          category: "general",
        },
      ],
    };

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => custom_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "y",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).toHaveBeenCalledWith("test.action");
  });

  it("ignores number slots with modifiers other than cmdorctrl", () => {
    const { registry } = create_mock_registry();
    const on_switch_to_tab = vi.fn();
    const on_select_pinned_vault = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => true,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault,
      on_switch_to_tab,
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "1",
      altKey: true,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_switch_to_tab).not.toHaveBeenCalled();
    expect(on_select_pinned_vault).not.toHaveBeenCalled();
  });

  it("only selects pinned vault for slots 0-4", () => {
    const { registry } = create_mock_registry();
    const on_select_pinned_vault = vi.fn();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault,
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "6",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(on_select_pinned_vault).not.toHaveBeenCalled();
  });

  it("executes omnibar actions even when blocked if omnibar is open", () => {
    const { registry, execute } = create_mock_registry();

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => default_config,
      is_enabled: () => true,
      is_blocked: () => true,
      is_omnibar_open: () => true,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "p",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).toHaveBeenCalled();
  });

  it("fires customized shortcut (rebound from default)", () => {
    const { registry, execute } = create_mock_registry();
    const customized_config: HotkeyConfig = {
      bindings: DEFAULT_HOTKEYS.map((b) =>
        b.action_id === "note.request_save"
          ? { ...b, key: "CmdOrCtrl+Shift+S" }
          : b,
      ),
    };

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => customized_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: "s",
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).toHaveBeenCalledWith("note.request_save");
  });

  it("does not fire original shortcut after rebinding", () => {
    const { registry, execute } = create_mock_registry();
    const customized_config: HotkeyConfig = {
      bindings: DEFAULT_HOTKEYS.map((b) =>
        b.action_id === "note.request_save"
          ? { ...b, key: "CmdOrCtrl+Shift+S" }
          : b,
      ),
    };

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => customized_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      key: "s",
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).not.toHaveBeenCalled();
  });

  it("does not fire cleared shortcut", () => {
    const { registry, execute } = create_mock_registry();
    const cleared_config: HotkeyConfig = {
      bindings: DEFAULT_HOTKEYS.filter(
        (b) => b.action_id !== "ui.toggle_sidebar",
      ),
    };

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => cleared_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      key: "b",
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(execute).not.toHaveBeenCalled();
  });

  it("fires multiple customized shortcuts independently", () => {
    const { registry, execute } = create_mock_registry();
    const multi_custom_config: HotkeyConfig = {
      bindings: DEFAULT_HOTKEYS.map((b) => {
        if (b.action_id === "note.request_save") {
          return { ...b, key: "CmdOrCtrl+Shift+S" };
        }
        if (b.action_id === "tab.close") {
          return { ...b, key: "CmdOrCtrl+Shift+W" };
        }
        if (b.action_id === "ui.toggle_sidebar") {
          return { ...b, key: "CmdOrCtrl+Shift+B" };
        }
        return b;
      }),
    };

    const shortcuts = use_keyboard_shortcuts({
      hotkeys_config: () => multi_custom_config,
      is_enabled: () => true,
      is_blocked: () => false,
      is_omnibar_open: () => false,
      is_vault_switcher_open: () => false,
      has_tabs: () => false,
      action_registry: registry,
      on_close_vault_switcher: vi.fn(),
      on_select_pinned_vault: vi.fn(),
      on_switch_to_tab: vi.fn(),
    });

    shortcuts.handle_keydown({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: "s",
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(execute).toHaveBeenCalledWith("note.request_save");

    execute.mockClear();
    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: "w",
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(execute).toHaveBeenCalledWith("tab.close");

    execute.mockClear();
    shortcuts.handle_keydown_capture({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: "b",
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(execute).toHaveBeenCalledWith("ui.toggle_sidebar");
  });
});
