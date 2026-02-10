import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type {
  MarkType,
  Node as ProseNode,
  Mark,
} from "@milkdown/kit/prose/model";
import { linkSchema } from "@milkdown/kit/preset/commonmark";
import {
  encode_wiki_link_href,
  format_wiki_target_for_markdown,
  resolve_wiki_target_to_note_path,
  try_decode_wiki_link_href,
} from "$lib/domain/wiki_link";
import { dirty_state_plugin_key } from "./dirty_state_plugin";

const ZERO_WIDTH_SPACE = "\u200B";
const WIKI_LINK_REGEX = /\[\[([^\]\n]+?)(?:\|([^\]\n]+?))?\]\]/;

type WikiLinkMeta = { action: "full_scan" };

function is_full_scan_action(value: unknown): value is WikiLinkMeta {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.action === "full_scan";
}

export const wiki_link_plugin_key = new PluginKey("wiki-link-plugin");

type Segment = {
  text: string;
  start_index: number;
  start_pos: number;
  has_link_mark: boolean;
  has_code_mark: boolean;
};

function build_segments(input: {
  text_block: ProseNode;
  block_start: number;
  link_type: MarkType;
}): { segments: Segment[]; combined: string; has_non_text_inline: boolean } {
  const segments: Segment[] = [];
  let combined = "";
  let current_index = 0;
  let has_non_text_inline = false;

  input.text_block.descendants((node: ProseNode, pos: number) => {
    if (node.isText && node.text) {
      segments.push({
        text: node.text,
        start_index: current_index,
        start_pos: input.block_start + pos,
        has_link_mark: node.marks.some((m: Mark) => m.type === input.link_type),
        has_code_mark: node.marks.some(
          (m: Mark) => m.type.name === "code_inline" || m.type.name === "code",
        ),
      });
      combined += node.text;
      current_index += node.text.length;
      return true;
    }

    if (node.isInline) {
      has_non_text_inline = true;
      return false;
    }

    return true;
  });

  return { segments, combined, has_non_text_inline };
}

function pos_from_index(segments: Segment[], index: number): number | null {
  for (const seg of segments) {
    const end = seg.start_index + seg.text.length;
    if (index >= seg.start_index && index < end) {
      return seg.start_pos + (index - seg.start_index);
    }
  }
  return null;
}

function contains_protected_mark(
  segments: Segment[],
  match_start_index: number,
  match_end_index: number,
): boolean {
  return segments.some((seg) => {
    if (!seg.has_link_mark && !seg.has_code_mark) return false;
    const seg_end = seg.start_index + seg.text.length;
    return seg.start_index < match_end_index && seg_end > match_start_index;
  });
}

function build_replacement(input: {
  link_type: MarkType;
  base_note_path: string;
  raw_target: string;
  raw_label: string | null;
}): { resolved_note_path: string; display: string; href: string } | null {
  const raw = input.raw_target.trim();
  if (raw === "") return null;

  const resolved = resolve_wiki_target_to_note_path({
    base_note_path: input.base_note_path,
    raw_target: raw,
  });

  const note_path = resolved ?? raw;
  const href = encode_wiki_link_href(note_path);
  const label = (input.raw_label ?? "").trim();

  const display = resolved
    ? label ||
      format_wiki_target_for_markdown({
        base_note_path: input.base_note_path,
        resolved_note_path: resolved,
      })
    : label || raw;

  return { resolved_note_path: note_path, display, href };
}

export function create_wiki_link_converter_prose_plugin(input: {
  link_type: MarkType;
  base_note_path: string;
}) {
  return new Plugin({
    key: wiki_link_plugin_key,
    appendTransaction(transactions, _old_state, new_state) {
      const force_full_scan = transactions.some((tr) =>
        is_full_scan_action(tr.getMeta(wiki_link_plugin_key)),
      );
      const should_scan =
        force_full_scan || transactions.some((tr) => tr.docChanged);
      if (!should_scan) return null;

      const tr = new_state.tr;

      const scan_textblock = (
        text_block: ProseNode,
        block_start: number,
        selection_anchor: number | null,
      ) => {
        if (!text_block.isTextblock) return;
        if (text_block.type.name === "code_block") return;

        const { segments, combined, has_non_text_inline } = build_segments({
          text_block,
          block_start,
          link_type: input.link_type,
        });
        if (has_non_text_inline) return;
        if (combined === "") return;

        if (selection_anchor === null) {
          const matches: Array<{
            full_match: string;
            raw_target: string;
            raw_label: string | null;
            start: number;
            end: number;
          }> = [];
          const regex = new RegExp(WIKI_LINK_REGEX.source, "g");
          let match: RegExpExecArray | null = null;

          while ((match = regex.exec(combined)) !== null) {
            const [full_match, raw_target, raw_label] = match;
            if (!raw_target) continue;

            const start = match.index;
            const end = start + full_match.length;
            if (contains_protected_mark(segments, start, end)) continue;
            matches.push({
              full_match,
              raw_target,
              raw_label: raw_label ?? null,
              start,
              end,
            });
          }

          for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            if (!m) continue;
            const start_pos = pos_from_index(segments, m.start);
            if (start_pos === null) continue;

            const replacement = build_replacement({
              link_type: input.link_type,
              base_note_path: input.base_note_path,
              raw_target: m.raw_target,
              raw_label: m.raw_label,
            });
            if (!replacement) continue;

            tr.replaceWith(start_pos, start_pos + m.full_match.length, [
              new_state.schema.text(replacement.display, [
                input.link_type.create({ href: replacement.href }),
              ]),
              new_state.schema.text(ZERO_WIDTH_SPACE),
            ]);
          }

          return;
        }

        const window_before = 1024;
        const window_after = 256;
        const anchor = selection_anchor;
        const window_start = Math.max(0, anchor - window_before);
        const window_end = Math.min(combined.length, anchor + window_after);
        const window_text = combined.slice(window_start, window_end);

        const match = WIKI_LINK_REGEX.exec(window_text);
        if (!match) return;

        const [full_match, raw_target, raw_label] = match;
        if (!raw_target) return;

        const match_start_index = window_start + match.index;
        const match_end_index = match_start_index + full_match.length;
        if (
          contains_protected_mark(segments, match_start_index, match_end_index)
        )
          return;

        const start = pos_from_index(segments, match_start_index);
        if (start === null) return;

        const replacement = build_replacement({
          link_type: input.link_type,
          base_note_path: input.base_note_path,
          raw_target,
          raw_label: raw_label ?? null,
        });
        if (!replacement) return;

        tr.replaceWith(start, start + full_match.length, [
          new_state.schema.text(replacement.display, [
            input.link_type.create({ href: replacement.href }),
          ]),
          new_state.schema.text(ZERO_WIDTH_SPACE),
        ]);

        tr.setSelection(
          TextSelection.create(tr.doc, start + replacement.display.length + 1),
        );
        tr.setStoredMarks([]);
      };

      if (force_full_scan) {
        const blocks: Array<{ node: ProseNode; pos: number }> = [];
        new_state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;
          blocks.push({ node, pos: pos + 1 });
          return false;
        });
        for (let i = blocks.length - 1; i >= 0; i--) {
          const block = blocks[i];
          if (block) scan_textblock(block.node, block.pos, null);
        }
        if (!tr.docChanged) return null;
        tr.setMeta(dirty_state_plugin_key, { action: "mark_clean" });
        return tr;
      }

      const from = new_state.selection.$from;
      const text_block = from.parent;
      if (!text_block.isTextblock) return null;
      if (from.parent.type.name === "code_block") return null;

      scan_textblock(text_block, from.start(), from.parentOffset);
      return tr.docChanged ? tr : null;
    },
  });
}

export function create_wiki_link_click_prose_plugin(input: {
  link_type: MarkType;
  base_note_path: string;
  on_wiki_link_click: (note_path: string) => void;
}) {
  function should_handle_event(event: MouseEvent): boolean {
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return false;
    return true;
  }

  function href_from_dom_event_target(event: MouseEvent): string | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return null;
    return anchor.getAttribute("href");
  }

  function is_external_href(href: string): boolean {
    try {
      new URL(href);
      return true;
    } catch {
      return false;
    }
  }

  function strip_hash_and_query(value: string): string {
    let end = value.length;
    const hash_index = value.indexOf("#");
    if (hash_index >= 0 && hash_index < end) end = hash_index;
    const query_index = value.indexOf("?");
    if (query_index >= 0 && query_index < end) end = query_index;
    return value.slice(0, end);
  }

  function safe_decode_uri_component(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function try_resolve_markdown_href(
    base_note_path: string,
    href: string,
  ): string | null {
    if (href.trim() === "") return null;
    if (is_external_href(href)) return null;

    const raw_path = strip_hash_and_query(href).trim();
    if (raw_path === "") return null;

    const decoded_path = safe_decode_uri_component(raw_path);
    const trimmed = decoded_path.trim();
    if (trimmed === "") return null;

    const last_slash_index = trimmed.lastIndexOf("/");
    const leaf =
      last_slash_index >= 0 ? trimmed.slice(last_slash_index + 1) : trimmed;
    if (leaf === "") return null;

    const has_dot = leaf.includes(".");
    const is_md = leaf.toLowerCase().endsWith(".md");
    if (has_dot && !is_md) return null;

    return resolve_wiki_target_to_note_path({
      base_note_path,
      raw_target: trimmed,
    });
  }

  function resolve_internal_href(href: string): string | null {
    const decoded = try_decode_wiki_link_href(href);
    if (decoded) return decoded;

    return try_resolve_markdown_href(input.base_note_path, href);
  }

  function handle_internal_link_click(args: {
    href: string;
    event: MouseEvent;
    stop_propagation: boolean;
  }): boolean {
    const resolved = resolve_internal_href(args.href);
    if (!resolved) return false;

    args.event.preventDefault();
    if (args.stop_propagation) args.event.stopPropagation();
    input.on_wiki_link_click(resolved);
    return true;
  }

  return new Plugin({
    key: new PluginKey("wiki-link-click"),
    props: {
      handleDOMEvents: {
        click: (_view, raw_event) => {
          if (!(raw_event instanceof MouseEvent)) return false;
          if (!should_handle_event(raw_event)) return false;

          const href = href_from_dom_event_target(raw_event);
          if (typeof href !== "string") return false;
          return handle_internal_link_click({
            href,
            event: raw_event,
            stop_propagation: true,
          });
        },
      },
      handleClick: (view, pos, event) => {
        if (!should_handle_event(event)) return false;

        const $pos = view.state.doc.resolve(pos);
        const marks = $pos.marks();
        const link_mark = marks.find((m) => m.type === input.link_type);
        const raw_href =
          href_from_dom_event_target(event) ??
          (link_mark?.attrs.href as unknown);
        if (typeof raw_href !== "string") return false;

        return handle_internal_link_click({
          href: raw_href,
          event,
          stop_propagation: false,
        });
      },
    },
  });
}

export const create_wiki_link_converter_plugin = (base_note_path: string) =>
  $prose((ctx) => {
    const link_type = linkSchema.type(ctx);
    return create_wiki_link_converter_prose_plugin({
      link_type,
      base_note_path,
    });
  });

export const create_wiki_link_click_plugin = (
  base_note_path: string,
  on_wiki_link_click: (note_path: string) => void,
) =>
  $prose((ctx) => {
    const link_type = linkSchema.type(ctx);
    return create_wiki_link_click_prose_plugin({
      link_type,
      base_note_path,
      on_wiki_link_click,
    });
  });
