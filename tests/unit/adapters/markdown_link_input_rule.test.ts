import { describe, it, expect } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import type {
  MarkType,
  Node as ProseNode,
  Mark,
} from "@milkdown/kit/prose/model";
import { create_markdown_link_input_rule_prose_plugin } from "$lib/features/editor/adapters/markdown_link_input_rule";

function create_schema() {
  const link = {
    attrs: { href: {} },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (dom: HTMLElement) => ({ href: dom.getAttribute("href") }),
      },
    ],
    toDOM: (mark: Mark, _inline: boolean) =>
      ["a", { href: String(mark.attrs["href"] ?? "") }, 0] as const,
  } as const;

  const doc = { content: "block+" } as const;
  const text = { group: "inline" } as const;
  const paragraph = {
    group: "block",
    content: "inline*",
    toDOM: () => ["p", 0] as const,
    parseDOM: [{ tag: "p" }],
  } as const;

  return new Schema({
    nodes: { doc, paragraph, text },
    marks: { link },
  });
}

function get_link_href(doc: ProseNode, link_mark: MarkType): string | null {
  let href: string | null = null;
  doc.descendants((node: ProseNode) => {
    if (!node.isText) return true;
    const mark = node.marks.find((m: Mark) => m.type === link_mark);
    if (!mark) return true;
    href = String(mark.attrs["href"] ?? "");
    return false;
  });
  return href;
}

describe("create_markdown_link_input_rule_prose_plugin", () => {
  it("converts markdown links whose .md target contains spaces", () => {
    const schema = create_schema();
    const plugin = create_markdown_link_input_rule_prose_plugin({
      link_type: schema.marks.link,
    });

    const state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [])]),
      plugins: [plugin],
    });

    const inserted = "[note title](some note.md)";
    const tr = state.tr.insertText(inserted, 1);
    tr.setSelection(TextSelection.create(tr.doc, inserted.length));
    const next = state.apply(tr);

    expect(next.doc.child(0).textContent.includes("[note title]")).toBe(false);
    expect(next.doc.child(0).textContent.includes("note title")).toBe(true);
    expect(get_link_href(next.doc, schema.marks.link)).toBe("some note.md");
  });

  it("converts markdown links with spaces in folder and file name", () => {
    const schema = create_schema();
    const plugin = create_markdown_link_input_rule_prose_plugin({
      link_type: schema.marks.link,
    });

    const state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [])]),
      plugins: [plugin],
    });

    const inserted = "[Roadmap](some folder/some note.md)";
    const tr = state.tr.insertText(inserted, 1);
    tr.setSelection(TextSelection.create(tr.doc, inserted.length));
    const next = state.apply(tr);

    expect(get_link_href(next.doc, schema.marks.link)).toBe(
      "some folder/some note.md",
    );
  });

  it("does not convert image markdown links", () => {
    const schema = create_schema();
    const plugin = create_markdown_link_input_rule_prose_plugin({
      link_type: schema.marks.link,
    });

    const state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [])]),
      plugins: [plugin],
    });

    const inserted = "![image](some note.md)";
    const tr = state.tr.insertText(inserted, 1);
    tr.setSelection(TextSelection.create(tr.doc, inserted.length));
    const next = state.apply(tr);

    expect(next.doc.child(0).textContent).toContain("![image](some note.md)");
    expect(get_link_href(next.doc, schema.marks.link)).toBeNull();
  });
});
