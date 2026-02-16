import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";

type FindHighlightMeta = {
  query: string;
  selected_index: number;
};

type MatchPosition = { from: number; to: number };

type FindHighlightState = {
  decorations: DecorationSet;
  query: string;
  selected_index: number;
  match_positions: MatchPosition[];
};

function is_find_highlight_meta(value: unknown): value is FindHighlightMeta {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.query === "string" && typeof obj.selected_index === "number"
  );
}

function escape_regex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function find_text_matches(doc: ProseNode, query: string): MatchPosition[] {
  const matches: MatchPosition[] = [];
  const pattern = new RegExp(escape_regex(query), "gi");

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(node.text)) !== null) {
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
    }
  });

  return matches;
}

function build_decorations(
  doc: ProseNode,
  match_positions: MatchPosition[],
  selected_index: number,
): DecorationSet {
  if (match_positions.length === 0) return DecorationSet.empty;

  const decorations = match_positions.map((pos, i) =>
    Decoration.inline(pos.from, pos.to, {
      class:
        i === selected_index ? "find-match find-match--selected" : "find-match",
    }),
  );

  return DecorationSet.create(doc, decorations);
}

export const find_highlight_plugin_key = new PluginKey<FindHighlightState>(
  "find-highlight",
);

export function create_find_highlight_prose_plugin() {
  return new Plugin<FindHighlightState>({
    key: find_highlight_plugin_key,
    state: {
      init() {
        return {
          decorations: DecorationSet.empty,
          query: "",
          selected_index: 0,
          match_positions: [],
        };
      },
      apply(tr, plugin_state, _old_state, new_state) {
        const meta = tr.getMeta(find_highlight_plugin_key) as unknown;

        if (is_find_highlight_meta(meta)) {
          const { query, selected_index } = meta;

          if (!query) {
            return {
              decorations: DecorationSet.empty,
              query: "",
              selected_index: 0,
              match_positions: [],
            };
          }

          const match_positions = find_text_matches(new_state.doc, query);
          const decorations = build_decorations(
            new_state.doc,
            match_positions,
            selected_index,
          );

          return { decorations, query, selected_index, match_positions };
        }

        if (!plugin_state.query) return plugin_state;

        if (tr.docChanged) {
          const match_positions = find_text_matches(
            new_state.doc,
            plugin_state.query,
          );
          const decorations = build_decorations(
            new_state.doc,
            match_positions,
            plugin_state.selected_index,
          );

          return { ...plugin_state, decorations, match_positions };
        }

        return plugin_state;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations;
      },
    },
  });
}

export const find_highlight_plugin = $prose(() =>
  create_find_highlight_prose_plugin(),
);
