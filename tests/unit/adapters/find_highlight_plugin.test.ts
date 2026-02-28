import { describe, it, expect } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import {
  create_find_highlight_prose_plugin,
  find_highlight_plugin_key,
} from "$lib/features/editor/adapters/find_highlight_plugin";

function create_simple_schema() {
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
    marks: {},
  });
}

function create_doc_with_paragraphs(
  schema: Schema,
  texts: string[],
): ProseNode {
  return schema.node(
    "doc",
    null,
    texts.map((text) =>
      text
        ? schema.node("paragraph", null, schema.text(text))
        : schema.node("paragraph"),
    ),
  );
}

function count_decorations(state: EditorState): number {
  const plugin_state = find_highlight_plugin_key.getState(state);
  if (!plugin_state) return 0;

  return plugin_state.decorations.find(0, state.doc.content.size).length;
}

describe("find_highlight_plugin", () => {
  describe("empty query", () => {
    it("produces DecorationSet.empty when query is empty", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, { query: "", selected_index: 0 });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(0);
      const plugin_state = find_highlight_plugin_key.getState(next);
      expect(plugin_state?.query).toBe("");
      expect(plugin_state?.match_positions).toHaveLength(0);
    });

    it("clears decorations when query becomes empty", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr1 = state.tr;
      tr1.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const state_with_matches = state.apply(tr1);
      expect(count_decorations(state_with_matches)).toBe(1);

      const tr2 = state_with_matches.tr;
      tr2.setMeta(find_highlight_plugin_key, { query: "", selected_index: 0 });
      const state_cleared = state_with_matches.apply(tr2);
      expect(count_decorations(state_cleared)).toBe(0);
    });
  });

  describe("no matches", () => {
    it("produces empty DecorationSet when query has no matches", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "nonexistent",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(0);
      const plugin_state = find_highlight_plugin_key.getState(next);
      expect(plugin_state?.query).toBe("nonexistent");
      expect(plugin_state?.match_positions).toHaveLength(0);
    });
  });

  describe("basic matching", () => {
    it("creates decorations for all matches in document", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, [
        "Hello world",
        "Another world here",
      ]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(2);
      const plugin_state = find_highlight_plugin_key.getState(next);
      expect(plugin_state?.match_positions).toHaveLength(2);
    });

    it("stores correct match positions", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const next = state.apply(tr);

      const plugin_state = find_highlight_plugin_key.getState(next);
      expect(plugin_state?.match_positions).toHaveLength(1);

      const pos = plugin_state?.match_positions[0];
      expect(pos).toBeDefined();
      expect(pos?.to).toBeGreaterThan(pos?.from ?? 0);
    });

    it("matches case-insensitively", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, [
        "Hello WORLD",
        "world here",
      ]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "WoRlD",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(2);
    });

    it("handles multiple matches in same text node", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["test test test"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "test",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(3);
    });
  });

  describe("selected match styling", () => {
    it("stores selected_index in plugin state", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["world world world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 1,
      });
      const next = state.apply(tr);

      const plugin_state = find_highlight_plugin_key.getState(next);
      expect(plugin_state?.selected_index).toBe(1);
      expect(count_decorations(next)).toBe(3);
    });

    it("updates selected_index when changed", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["world world world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr1 = state.tr;
      tr1.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const state1 = state.apply(tr1);

      let plugin_state = find_highlight_plugin_key.getState(state1);
      expect(plugin_state?.selected_index).toBe(0);

      const tr2 = state1.tr;
      tr2.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 2,
      });
      const state2 = state1.apply(tr2);

      plugin_state = find_highlight_plugin_key.getState(state2);
      expect(plugin_state?.selected_index).toBe(2);
    });
  });

  describe("query changes", () => {
    it("rebuilds decorations when query changes", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr1 = state.tr;
      tr1.setMeta(find_highlight_plugin_key, {
        query: "hello",
        selected_index: 0,
      });
      const state1 = state.apply(tr1);
      expect(count_decorations(state1)).toBe(1);

      const tr2 = state1.tr;
      tr2.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const state2 = state1.apply(tr2);
      expect(count_decorations(state2)).toBe(1);

      const plugin_state = find_highlight_plugin_key.getState(state2);
      expect(plugin_state?.query).toBe("world");
    });
  });

  describe("regex special characters", () => {
    it("escapes regex special characters in query", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Price: $10.00"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "$10",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(1);
    });

    it("handles parentheses in query", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["function(arg)"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "function(arg)",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(1);
    });

    it("handles square brackets in query", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["array[0]"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "array[0]",
        selected_index: 0,
      });
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(1);
    });
  });

  describe("document changes with active query", () => {
    it("re-scans decorations when document changes", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr1 = state.tr;
      tr1.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const state1 = state.apply(tr1);
      expect(count_decorations(state1)).toBe(1);

      const tr2 = state1.tr;
      tr2.insertText(" world");
      const state2 = state1.apply(tr2);

      expect(count_decorations(state2)).toBe(2);
    });

    it("updates decorations when text is deleted", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["world world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr1 = state.tr;
      tr1.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const state1 = state.apply(tr1);
      expect(count_decorations(state1)).toBe(2);

      const tr2 = state1.tr;
      tr2.delete(1, 7);
      const state2 = state1.apply(tr2);

      expect(count_decorations(state2)).toBe(1);
    });

    it("does not re-scan when no query is active", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["Hello world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.insertText(" more text");
      const next = state.apply(tr);

      expect(count_decorations(next)).toBe(0);
    });
  });

  describe("match_positions tracking", () => {
    it("stores match positions in plugin state", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["world world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr = state.tr;
      tr.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const next = state.apply(tr);

      const positions =
        find_highlight_plugin_key.getState(next)?.match_positions ?? [];
      expect(positions).toHaveLength(2);
      const first = positions[0];
      if (!first) return;
      expect(first.from).toBeGreaterThan(0);
      expect(first.to).toBeGreaterThan(first.from);
    });

    it("clears match_positions when query is empty", () => {
      const schema = create_simple_schema();
      const plugin = create_find_highlight_prose_plugin();
      const doc = create_doc_with_paragraphs(schema, ["world world"]);

      const state = EditorState.create({
        schema,
        doc,
        plugins: [plugin],
      });

      const tr1 = state.tr;
      tr1.setMeta(find_highlight_plugin_key, {
        query: "world",
        selected_index: 0,
      });
      const state1 = state.apply(tr1);

      const tr2 = state1.tr;
      tr2.setMeta(find_highlight_plugin_key, { query: "", selected_index: 0 });
      const state2 = state1.apply(tr2);

      const plugin_state = find_highlight_plugin_key.getState(state2);
      expect(plugin_state?.match_positions).toHaveLength(0);
    });
  });
});
