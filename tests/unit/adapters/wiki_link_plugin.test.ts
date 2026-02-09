import { describe, it, expect } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import { create_wiki_link_converter_prose_plugin } from "$lib/adapters/editor/wiki_link_plugin";
import type {
  MarkType,
  Node as ProseNode,
  Mark,
} from "@milkdown/kit/prose/model";

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

  const code_inline = {
    inclusive: false,
    parseDOM: [{ tag: "code" }],
    toDOM: () => ["code", 0] as const,
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
    marks: { link, code_inline },
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

describe("create_wiki_link_converter_prose_plugin", () => {
  it("converts a wikilink into a link mark", () => {
    const schema = create_schema();
    const plugin = create_wiki_link_converter_prose_plugin({
      link_type: schema.marks.link,
      base_note_path: "abc/pqr/current.md",
    });

    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("See ")),
    ]);

    const state = EditorState.create({
      schema,
      doc,
      plugins: [plugin],
    });

    const inserted = "[[note]]";
    const insert_pos = 1 + "See ".length;
    const tr = state.tr.insertText(inserted, insert_pos);
    tr.setSelection(
      TextSelection.create(tr.doc, insert_pos + inserted.length - 1),
    );
    const next = state.apply(tr);

    const para = next.doc.child(0);
    expect(para.textContent.includes("[[")).toBe(false);
    expect(para.textContent.includes("note")).toBe(true);

    const href = get_link_href(next.doc, schema.marks.link);
    expect(href).not.toBeNull();
    const url = new URL(String(href));
    expect(url.searchParams.get("path")).toBe("abc/pqr/note.md");
  });

  it("converts labeled wikilinks", () => {
    const schema = create_schema();
    const plugin = create_wiki_link_converter_prose_plugin({
      link_type: schema.marks.link,
      base_note_path: "abc/pqr/current.md",
    });

    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("Go to ")),
    ]);

    const state = EditorState.create({
      schema,
      doc,
      plugins: [plugin],
    });

    const inserted = "[[note|Label]]";
    const insert_pos = 1 + "Go to ".length;
    const tr = state.tr.insertText(inserted, insert_pos);
    tr.setSelection(
      TextSelection.create(tr.doc, insert_pos + inserted.length - 1),
    );
    const next = state.apply(tr);

    const para = next.doc.child(0);
    expect(para.textContent.includes("Label")).toBe(true);

    const href = get_link_href(next.doc, schema.marks.link);
    expect(href).not.toBeNull();
    const url = new URL(String(href));
    expect(url.searchParams.get("path")).toBe("abc/pqr/note.md");
  });

  it("does not convert wikilinks inside code marks", () => {
    const schema = create_schema();
    const plugin = create_wiki_link_converter_prose_plugin({
      link_type: schema.marks.link,
      base_note_path: "abc/pqr/current.md",
    });

    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("Code: ")),
    ]);

    const state = EditorState.create({
      schema,
      doc,
      plugins: [plugin],
    });

    const insert_pos = 1 + "Code: ".length;
    const tr = state.tr.setSelection(
      TextSelection.create(state.doc, insert_pos),
    );
    tr.setStoredMarks([schema.marks.code_inline.create()]);
    tr.insertText("[[note]]", insert_pos);
    tr.setSelection(
      TextSelection.create(tr.doc, insert_pos + "[[note]]".length - 1),
    );
    const next = state.apply(tr);

    const para = next.doc.child(0);
    expect(para.textContent.includes("[[note]]")).toBe(true);
    expect(get_link_href(next.doc, schema.marks.link)).toBeNull();
  });
});
