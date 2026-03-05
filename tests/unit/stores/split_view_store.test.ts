import { describe, expect, it } from "vitest";
import { SplitViewStore } from "$lib/features/split_view";
import {
  create_test_note,
  create_open_note_state,
} from "../helpers/test_fixtures";

function make_note(id = "note-1", title = "Test Note") {
  return create_open_note_state(create_test_note(id, title));
}

describe("SplitViewStore", () => {
  it("starts inactive with no secondary note", () => {
    const store = new SplitViewStore();
    expect(store.active).toBe(false);
    expect(store.secondary_note).toBeNull();
    expect(store.active_pane).toBe("primary");
  });

  it("opens secondary note and activates", () => {
    const store = new SplitViewStore();
    const note = make_note();

    store.open_secondary(note);

    expect(store.active).toBe(true);
    expect(store.secondary_note).toBe(note);
    expect(store.active_pane).toBe("secondary");
  });

  it("closes and resets to defaults", () => {
    const store = new SplitViewStore();
    store.open_secondary(make_note());

    store.close();

    expect(store.active).toBe(false);
    expect(store.secondary_note).toBeNull();
    expect(store.active_pane).toBe("primary");
  });

  it("close is safe when already inactive", () => {
    const store = new SplitViewStore();

    store.close();

    expect(store.active).toBe(false);
  });

  it("sets active pane", () => {
    const store = new SplitViewStore();

    store.set_active_pane("secondary");
    expect(store.active_pane).toBe("secondary");

    store.set_active_pane("primary");
    expect(store.active_pane).toBe("primary");
  });
});
