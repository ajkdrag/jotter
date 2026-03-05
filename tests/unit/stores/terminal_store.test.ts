import { describe, expect, it } from "vitest";
import { TerminalStore } from "$lib/features/terminal";

describe("TerminalStore", () => {
  it("starts with panel closed", () => {
    const store = new TerminalStore();
    expect(store.panel_open).toBe(false);
  });

  it("toggle opens and closes", () => {
    const store = new TerminalStore();

    store.toggle();
    expect(store.panel_open).toBe(true);

    store.toggle();
    expect(store.panel_open).toBe(false);
  });

  it("open sets panel_open to true", () => {
    const store = new TerminalStore();
    store.open();
    expect(store.panel_open).toBe(true);
  });

  it("close sets panel_open to false", () => {
    const store = new TerminalStore();
    store.open();
    store.close();
    expect(store.panel_open).toBe(false);
  });

  it("close is safe when already closed", () => {
    const store = new TerminalStore();
    store.close();
    expect(store.panel_open).toBe(false);
  });

  it("reset closes the panel", () => {
    const store = new TerminalStore();
    store.open();
    store.reset();
    expect(store.panel_open).toBe(false);
  });
});
