import { describe, expect, it, vi } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import { create_commands } from "$lib/features/editor/adapters/slash_command_plugin";

function create_schema() {
  return new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: {
        group: "block",
        content: "inline*",
        toDOM: () => ["p", 0] as const,
        parseDOM: [{ tag: "p" }],
      },
      bullet_list: {
        group: "block",
        content: "list_item+",
        toDOM: () => ["ul", 0] as const,
        parseDOM: [{ tag: "ul" }],
      },
      list_item: {
        attrs: { checked: { default: null } },
        content: "block+",
        toDOM: () => ["li", 0] as const,
        parseDOM: [{ tag: "li" }],
      },
      text: { group: "inline" },
    },
  });
}

function find_command(id: string) {
  const command = create_commands().find((cmd) => cmd.id === id);
  if (!command) throw new Error(`command "${id}" not found`);
  return command;
}

describe("slash task-list insertion", () => {
  it("replaces slash query with unchecked task list and places cursor in item", () => {
    const schema = create_schema();
    const paragraph = schema.nodes["paragraph"].create(
      null,
      schema.text("    /todo"),
    );
    const doc = schema.nodes["doc"].create(null, [paragraph]);
    const initial = EditorState.create({ doc });
    const state = initial.apply(
      initial.tr.setSelection(
        TextSelection.create(doc, 1 + "    /todo".length),
      ),
    );

    const dispatched: Array<import("@milkdown/kit/prose/state").Transaction> =
      [];
    const view = {
      state,
      dispatch: (tr: import("@milkdown/kit/prose/state").Transaction) =>
        dispatched.push(tr),
      focus: vi.fn(),
    } as unknown as import("@milkdown/kit/prose/view").EditorView;

    find_command("todo").insert(view, 1);

    expect(dispatched).toHaveLength(1);
    const tr = dispatched[0];
    if (!tr) throw new Error("expected todo insertion transaction");
    const first = tr.doc.firstChild;
    expect(first?.type.name).toBe("bullet_list");
    expect(first?.firstChild?.type.name).toBe("list_item");
    expect(first?.firstChild?.attrs["checked"]).toBe(false);

    expect(tr.selection.empty).toBe(true);
    expect(tr.selection.$from.parent.type.name).toBe("paragraph");
  });
});
