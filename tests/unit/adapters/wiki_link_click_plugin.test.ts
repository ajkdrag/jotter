import { describe, it, expect, vi, beforeAll } from "vitest";
import { create_wiki_link_click_prose_plugin } from "$lib/adapters/editor/wiki_link_plugin";

class MockElement {
  closest(_selector: string): unknown {
    return null;
  }
}

class MockAnchorElement extends MockElement {
  private readonly _href: string;
  constructor(href: string) {
    super();
    this._href = href;
  }
  override closest(selector: string): unknown {
    if (selector === "a[href]") return this;
    return null;
  }
  getAttribute(name: string): string | null {
    return name === "href" ? this._href : null;
  }
}

beforeAll(() => {
  if (typeof globalThis.Element === "undefined") {
    (globalThis as Record<string, unknown>).Element = MockElement;
  }
  if (typeof globalThis.HTMLAnchorElement === "undefined") {
    (globalThis as Record<string, unknown>).HTMLAnchorElement =
      MockAnchorElement;
  }
});

function create_mouse_event(
  href: string | null,
  overrides?: Partial<MouseEvent>,
) {
  const prevent_default = vi.fn();
  const stop_propagation = vi.fn();
  const target = href ? new MockAnchorElement(href) : null;

  const event = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target,
    preventDefault: prevent_default,
    stopPropagation: stop_propagation,
    ...overrides,
  } as unknown as MouseEvent;
  return { event, prevent_default, stop_propagation };
}

describe("create_wiki_link_click_prose_plugin", () => {
  function setup() {
    const on_internal_link_click = vi.fn();
    const on_external_link_click = vi.fn();

    const plugin = create_wiki_link_click_prose_plugin({
      base_note_path: "folder/current.md",
      on_internal_link_click,
      on_external_link_click,
    });

    return { plugin, on_internal_link_click, on_external_link_click };
  }

  function invoke_dom_click(
    plugin: ReturnType<typeof create_wiki_link_click_prose_plugin>,
    event: MouseEvent,
  ) {
    const handler = plugin.props.handleDOMEvents?.click;
    if (!handler) return false;
    return handler.call(plugin, null as never, event as never);
  }

  it("always calls preventDefault for internal wiki link clicks", () => {
    const { plugin, on_internal_link_click } = setup();

    const href = "jotter://wiki/?path=folder%2Fnote.md";
    const { event, prevent_default } = create_mouse_event(href);
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(true);
    expect(prevent_default).toHaveBeenCalled();
    expect(on_internal_link_click).toHaveBeenCalledWith("folder/note.md");
  });

  it("calls preventDefault and fires external callback for http links", () => {
    const { plugin, on_external_link_click, on_internal_link_click } = setup();

    const { event, prevent_default } = create_mouse_event(
      "https://example.com",
    );
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(true);
    expect(prevent_default).toHaveBeenCalled();
    expect(on_external_link_click).toHaveBeenCalledWith("https://example.com");
    expect(on_internal_link_click).not.toHaveBeenCalled();
  });

  it("calls preventDefault even when internal href cannot be resolved", () => {
    const { plugin, on_internal_link_click } = setup();

    const { event, prevent_default } = create_mouse_event(
      "nonexistent-note.md",
    );
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(true);
    expect(prevent_default).toHaveBeenCalled();
    expect(on_internal_link_click).toHaveBeenCalledWith(
      "folder/nonexistent-note.md",
    );
  });

  it("does not handle non-left clicks", () => {
    const { plugin } = setup();

    const { event, prevent_default } = create_mouse_event(
      "https://example.com",
      { button: 2 },
    );
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(false);
    expect(prevent_default).not.toHaveBeenCalled();
  });

  it("does not handle clicks with modifier keys", () => {
    const { plugin } = setup();

    const { event, prevent_default } = create_mouse_event(
      "https://example.com",
      { metaKey: true },
    );
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(false);
    expect(prevent_default).not.toHaveBeenCalled();
  });

  it("ignores non-md file extensions", () => {
    const { plugin, on_internal_link_click, on_external_link_click } = setup();

    const { event, prevent_default } = create_mouse_event("image.png");
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(true);
    expect(prevent_default).toHaveBeenCalled();
    expect(on_internal_link_click).not.toHaveBeenCalled();
    expect(on_external_link_click).not.toHaveBeenCalled();
  });

  it("does not handle clicks on non-anchor elements", () => {
    const { plugin } = setup();

    const { event, prevent_default } = create_mouse_event(null);
    const result = invoke_dom_click(plugin, event);

    expect(result).toBe(false);
    expect(prevent_default).not.toHaveBeenCalled();
  });
});
