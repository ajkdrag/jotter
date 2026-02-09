import {
  Editor,
  defaultValueCtx,
  editorViewOptionsCtx,
  rootCtx,
  editorViewCtx,
  parserCtx,
} from "@milkdown/kit/core";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import type { CursorInfo } from "$lib/types/editor";
import { Slice } from "@milkdown/kit/prose/model";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { Selection } from "@milkdown/kit/prose/state";
import {
  configureLinkTooltip,
  linkTooltipPlugin,
  linkTooltipConfig,
} from "@milkdown/kit/component/link-tooltip";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { listItemBlockComponent } from "@milkdown/kit/component/list-item-block";
import {
  imageBlockComponent,
  imageBlockConfig,
} from "@milkdown/kit/component/image-block";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { prism } from "@milkdown/plugin-prism";
import { indent } from "@milkdown/plugin-indent";
import { replaceAll } from "@milkdown/kit/utils";
import {
  Check,
  ImageOff,
  Link,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-static";
import type { EditorPort } from "$lib/ports/editor_port";
import type { AssetPath, VaultId } from "$lib/types/ids";
import { as_asset_path } from "$lib/types/ids";
import {
  dirty_state_plugin,
  dirty_state_plugin_config_key,
  dirty_state_plugin_key,
} from "./dirty_state_plugin";
import { markdown_link_input_rule_plugin } from "./markdown_link_input_rule";
import { image_input_rule_plugin } from "./image_input_rule_plugin";
import { markdown_paste_plugin } from "./markdown_paste_plugin";
import { create_image_paste_plugin } from "./image_paste_plugin";
import {
  create_wiki_link_click_plugin,
  create_wiki_link_converter_plugin,
  wiki_link_plugin_key,
} from "./wiki_link_plugin";
import {
  set_wiki_suggestions,
  wiki_suggest_plugin,
  wiki_suggest_plugin_config_key,
} from "./wiki_suggest_plugin";
import {
  format_wiki_target_for_markdown,
  format_wiki_target_for_markdown_link,
  try_decode_wiki_link_href,
} from "$lib/utils/wiki_link";

function create_svg_data_uri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PLACEHOLDER_IMAGE_WIDTH = 1200;
const PLACEHOLDER_IMAGE_HEIGHT = 675;

function create_icon_placeholder_data_uri(
  icon_svg: string,
  color: string,
): string {
  const svg = icon_svg
    .replace(/width="24"/, `width="${String(PLACEHOLDER_IMAGE_WIDTH)}"`)
    .replace(/height="24"/, `height="${String(PLACEHOLDER_IMAGE_HEIGHT)}"`)
    .replace(/stroke="currentColor"/g, `stroke="${color}"`);
  return create_svg_data_uri(svg);
}

const IMAGE_LOADING_PLACEHOLDER = create_icon_placeholder_data_uri(
  LoaderCircle,
  "#71717a",
);
const IMAGE_LOAD_ERROR_PLACEHOLDER = create_icon_placeholder_data_uri(
  ImageOff,
  "#b91c1c",
);

function resize_icon(svg: string, size: number): string {
  return svg
    .replace(/width="24"/, `width="${String(size)}"`)
    .replace(/height="24"/, `height="${String(size)}"`);
}

const LINK_TOOLTIP_ICONS = {
  link: resize_icon(Link, 16),
  edit: resize_icon(Pencil, 14),
  trash: resize_icon(Trash2, 14),
  check: resize_icon(Check, 14),
} as const;

const LARGE_DOC_LINE_THRESHOLD = 8000;
const LARGE_DOC_CHAR_THRESHOLD = 400_000;

function count_lines(text: string): number {
  if (text === "") return 1;

  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++;
  }
  return lines;
}

function is_large_markdown(text: string): boolean {
  if (text.length >= LARGE_DOC_CHAR_THRESHOLD) return true;
  return count_lines(text) >= LARGE_DOC_LINE_THRESHOLD;
}

function calculate_cursor_info(
  doc: ProseNode,
  selection: Selection | null | undefined,
): CursorInfo {
  const $from = selection?.$from;
  if (!$from) return { line: 1, column: 1, total_lines: doc.childCount || 1 };

  const line = $from.index(0) + 1;
  const column = $from.parentOffset + 1;
  const total_lines = doc.childCount || 1;
  return { line, column, total_lines };
}

const cursor_plugin_key = new PluginKey("cursor-tracker");

function create_cursor_plugin(on_cursor_change: (info: CursorInfo) => void) {
  return $prose(
    () =>
      new Plugin({
        key: cursor_plugin_key,
        view: () => ({
          update: (view) => {
            const { doc, selection } = view.state;
            const info = calculate_cursor_info(doc, selection);
            on_cursor_change(info);
          },
        }),
      }),
  );
}

type ResolveAssetUrlForVault = (
  vault_id: VaultId,
  asset_path: AssetPath,
) => string | Promise<string>;

export function create_milkdown_editor_port(args?: {
  resolve_asset_url_for_vault?: ResolveAssetUrlForVault;
}): EditorPort {
  const resolve_asset_url_for_vault = args?.resolve_asset_url_for_vault ?? null;

  return {
    start_session: async (config) => {
      const {
        root,
        initial_markdown,
        note_path,
        link_syntax,
        vault_id,
        events,
      } = config;
      const {
        on_markdown_change,
        on_dirty_state_change,
        on_cursor_change,
        on_internal_link_click,
        on_image_paste_requested,
        on_wiki_suggest_query,
      } = events;

      let current_markdown = initial_markdown;
      let current_is_dirty = false;
      let editor: Editor | null = null;
      let is_large_note = is_large_markdown(initial_markdown);

      function normalize_markdown(raw: string): string {
        const needs_zws_cleanup = raw.includes("\u200B");
        const needs_wiki_cleanup = raw.includes("jotter://wiki");
        if (!needs_zws_cleanup && !needs_wiki_cleanup) return raw;

        const without_zws = needs_zws_cleanup
          ? raw.replaceAll("\u200B", "")
          : raw;
        if (!needs_wiki_cleanup) return without_zws;

        return without_zws.replace(
          /\[([^\]]+)\]\((jotter:\/\/wiki\/?\?[^)\s]+)\)/g,
          (full, label, href) => {
            const resolved_note_path = try_decode_wiki_link_href(String(href));
            if (!resolved_note_path) return full;

            const safe_label = String(label);
            if (link_syntax === "markdown") {
              const target = format_wiki_target_for_markdown_link({
                base_note_path: note_path,
                resolved_note_path,
              });

              return `[${safe_label}](${target})`;
            }

            const target = format_wiki_target_for_markdown({
              base_note_path: note_path,
              resolved_note_path,
            });

            if (safe_label === target) return `[[${target}]]`;
            return `[[${target}|${safe_label}]]`;
          },
        );
      }

      let builder = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initial_markdown);
          ctx.set(editorViewOptionsCtx, { editable: () => true });
        })
        .config(configureLinkTooltip)
        .config((ctx) => {
          ctx.update(linkTooltipConfig.key, (defaultConfig) => ({
            ...defaultConfig,
            linkIcon: LINK_TOOLTIP_ICONS.link,
            editButton: LINK_TOOLTIP_ICONS.edit,
            removeButton: LINK_TOOLTIP_ICONS.trash,
            confirmButton: LINK_TOOLTIP_ICONS.check,
            inputPlaceholder: "Enter URL...",
          }));
        })
        .use(commonmark)
        .use(imageBlockComponent)
        .config((ctx) => {
          if (vault_id && resolve_asset_url_for_vault) {
            const resolve = resolve_asset_url_for_vault;
            const vid = vault_id;
            const resolved_url_cache = new Map<string, string>();
            const pending_resolutions = new Set<string>();
            const update_image_height = (
              img: HTMLImageElement,
              ratio: number,
            ) => {
              const host = img.closest(".milkdown-image-block");
              if (!(host instanceof HTMLElement)) return;

              const max_width = host.getBoundingClientRect().width;
              if (!max_width) return;

              const natural_width = img.naturalWidth;
              const natural_height = img.naturalHeight;
              if (!natural_width || !natural_height) return;

              const transformed_height =
                natural_width < max_width
                  ? natural_height
                  : max_width * (natural_height / natural_width);
              const base_height = transformed_height.toFixed(2);
              const rendered_height = (transformed_height * ratio).toFixed(2);
              img.dataset.origin = base_height;
              img.dataset.height = rendered_height;
              img.style.height = `${rendered_height}px`;
            };
            const apply_resolved_url_to_rendered_nodes = (
              src: string,
              resolved_url: string,
            ) => {
              try {
                const view = ctx.get(editorViewCtx);
                view.state.doc.descendants((node, pos) => {
                  if (
                    node.type.name === "image-block" &&
                    node.attrs.src === src
                  ) {
                    const node_dom = view.nodeDOM(pos);
                    if (!(node_dom instanceof HTMLElement)) return;
                    const img = node_dom.querySelector("img");
                    if (!(img instanceof HTMLImageElement)) return;
                    const ratio =
                      typeof node.attrs.ratio === "number"
                        ? node.attrs.ratio
                        : 1;
                    const finalize_size = () => {
                      update_image_height(img, ratio);
                    };
                    if (img.src === resolved_url) {
                      if (img.complete && img.naturalWidth > 0) finalize_size();
                      return;
                    }
                    img.style.removeProperty("height");
                    delete img.dataset.origin;
                    delete img.dataset.height;
                    img.addEventListener("load", finalize_size, { once: true });
                    img.src = resolved_url;
                  }
                });
              } catch {
                return;
              }
            };
            const finalize_resolution = (src: string, resolved_url: string) => {
              resolved_url_cache.set(src, resolved_url);
              pending_resolutions.delete(src);
              apply_resolved_url_to_rendered_nodes(src, resolved_url);
            };

            ctx.update(imageBlockConfig.key, (default_config) => ({
              ...default_config,
              proxyDomURL: (url: string) => {
                if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;

                const cached = resolved_url_cache.get(url);
                if (cached) return cached;

                const result = resolve(vid, as_asset_path(url));
                if (typeof result === "string") {
                  resolved_url_cache.set(url, result);
                  return result;
                }

                if (!pending_resolutions.has(url)) {
                  pending_resolutions.add(url);
                  void result
                    .then((resolved_url) => {
                      finalize_resolution(url, resolved_url);
                    })
                    .catch((error: unknown) => {
                      console.error(
                        "Failed to resolve asset URL for image block:",
                        error,
                      );
                      finalize_resolution(url, IMAGE_LOAD_ERROR_PLACEHOLDER);
                    });
                }

                return IMAGE_LOADING_PLACEHOLDER;
              },
            }));
          }
        })
        .use(gfm)
        .use(prism)
        .use(indent)
        .use(linkTooltipPlugin)
        .use(listItemBlockComponent)
        .use(markdown_link_input_rule_plugin)
        .use(image_input_rule_plugin)
        .use(create_wiki_link_converter_plugin(note_path))
        .use(listener)
        .use(history)
        .use(dirty_state_plugin_config_key)
        .use(dirty_state_plugin)
        .config((ctx) => {
          ctx.set(dirty_state_plugin_config_key.key, {
            on_dirty_state_change: (is_dirty) => {
              current_is_dirty = is_dirty;
              on_dirty_state_change(is_dirty);
            },
          });

          const listener_instance = ctx.get(listenerCtx);
          listener_instance.markdownUpdated((_ctx, markdown, prev_markdown) => {
            if (markdown === prev_markdown) return;

            const normalized = normalize_markdown(markdown);
            if (normalized === current_markdown) return;

            current_markdown = normalized;
            on_markdown_change(normalized);
          });
        });

      builder = builder.use(markdown_paste_plugin).use(clipboard);

      if (on_internal_link_click) {
        builder = builder.use(
          create_wiki_link_click_plugin(note_path, on_internal_link_click),
        );
      }

      if (on_cursor_change) {
        builder = builder.use(create_cursor_plugin(on_cursor_change));
      }

      if (on_image_paste_requested) {
        builder = builder.use(
          create_image_paste_plugin(on_image_paste_requested),
        );
      }

      if (on_wiki_suggest_query) {
        builder = builder
          .use(wiki_suggest_plugin_config_key)
          .use(wiki_suggest_plugin)
          .config((ctx) => {
            ctx.set(wiki_suggest_plugin_config_key.key, {
              on_query: on_wiki_suggest_query,
              on_dismiss: () => {},
              base_note_path: note_path,
            });
          });
      }

      editor = await builder.create();

      if (!is_large_note) {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const tr = view.state.tr.setMeta(wiki_link_plugin_key, {
            action: "full_scan",
          });
          view.dispatch(tr);
        });
      }

      function mark_clean() {
        if (!editor) return;
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const tr = view.state.tr;
          tr.setMeta(dirty_state_plugin_key, { action: "mark_clean" });
          view.dispatch(tr);
        });
      }

      const handle = {
        destroy() {
          if (!editor) return;
          void editor.destroy();
          editor = null;
        },
        set_markdown(markdown: string) {
          if (!editor) return;
          is_large_note = is_large_markdown(markdown);
          current_markdown = markdown;
          editor.action(replaceAll(markdown));
          if (!is_large_note) {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const tr = view.state.tr.setMeta(wiki_link_plugin_key, {
                action: "full_scan",
              });
              view.dispatch(tr);
            });
          }
        },
        get_markdown() {
          return current_markdown;
        },
        insert_text_at_cursor(text: string) {
          if (!editor) return;
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state } = view;
            try {
              const parser = ctx.get(parserCtx);
              const doc = parser(text);
              const tr = state.tr.replaceSelection(
                new Slice(doc.content, 0, 0),
              );
              view.dispatch(tr);
              view.focus();
            } catch (error) {
              console.error("Failed to insert markdown at cursor:", error);
              const tr = state.tr.insertText(
                text,
                state.selection.from,
                state.selection.to,
              );
              view.dispatch(tr.scrollIntoView());
              view.focus();
            }
          });
        },
        mark_clean,
        is_dirty() {
          return current_is_dirty;
        },
        focus() {
          if (!editor) return;
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            view.focus();
          });
        },
        set_wiki_suggestions(items: Array<{ title: string; path: string }>) {
          if (!editor) return;
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            set_wiki_suggestions(view, items);
          });
        },
      };

      mark_clean();

      return handle;
    },
  };
}
