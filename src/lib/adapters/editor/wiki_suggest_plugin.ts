import { $ctx, $prose } from "@milkdown/kit/utils";
import { TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { format_wiki_target_for_markdown } from "$lib/domain/wiki_link";

export const wiki_suggest_plugin_key = new PluginKey<WikiSuggestState>(
  "wiki-suggest",
);

type SuggestionItem = {
  title: string;
  path: string;
  kind: "existing" | "planned";
  ref_count?: number | undefined;
};

type WikiSuggestState = {
  active: boolean;
  query: string;
  from: number;
  items: SuggestionItem[];
  selected_index: number;
};

export type WikiSuggestPluginConfig = {
  on_query: (query: string) => void;
  on_dismiss: () => void;
  base_note_path: string;
};

export const wiki_suggest_plugin_config_key = $ctx<
  WikiSuggestPluginConfig,
  "wiki_suggest_plugin_config"
>(
  {
    on_query: () => {},
    on_dismiss: () => {},
    base_note_path: "",
  } as WikiSuggestPluginConfig,
  "wiki_suggest_plugin_config",
);

const EMPTY_STATE: WikiSuggestState = {
  active: false,
  query: "",
  from: 0,
  items: [],
  selected_index: 0,
};

function extract_wiki_query(
  text_before: string,
): { query: string; offset: number } | null {
  const open_idx = text_before.lastIndexOf("[[");
  if (open_idx === -1) return null;
  const after_open = text_before.slice(open_idx + 2);
  if (after_open.includes("]]") || after_open.includes("\n")) return null;
  if (after_open.includes("|")) return null;
  return { query: after_open, offset: open_idx };
}

function create_dropdown(): HTMLElement {
  const el = document.createElement("div");
  el.className = "WikiSuggest";
  return el;
}

function render_items(
  dropdown: HTMLElement,
  items: SuggestionItem[],
  selected_index: number,
  on_select: (index: number) => void,
) {
  dropdown.innerHTML = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "WikiSuggest__item";
    if (i === selected_index) row.classList.add("WikiSuggest__item--selected");
    if (item.kind === "planned") {
      row.classList.add("WikiSuggest__item--planned");
    }

    const label = document.createElement("span");
    label.className = "WikiSuggest__label";
    label.textContent = item.title;
    row.appendChild(label);

    if (item.kind === "planned") {
      const refs = document.createElement("span");
      refs.className = "WikiSuggest__badge";
      refs.textContent = `${String(item.ref_count ?? 0)} refs`;
      row.appendChild(refs);
    }

    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      on_select(i);
    });
    dropdown.appendChild(row);
  }
}

function scroll_selected_item_into_view(
  dropdown: HTMLElement,
  selected_index: number,
) {
  const row = dropdown.children.item(selected_index);
  if (!(row instanceof HTMLElement)) return;

  const row_top = row.offsetTop;
  const row_bottom = row_top + row.offsetHeight;
  const view_top = dropdown.scrollTop;
  const view_bottom = view_top + dropdown.clientHeight;

  if (row_top < view_top) {
    dropdown.scrollTop = row_top;
    return;
  }

  if (row_bottom > view_bottom) {
    dropdown.scrollTop = row_bottom - dropdown.clientHeight;
  }
}

export function create_wiki_suggest_prose_plugin(
  config: WikiSuggestPluginConfig,
): Plugin<WikiSuggestState> {
  let dropdown: HTMLElement | null = null;
  let provider: TooltipProvider | null = null;
  let debounce_timer: ReturnType<typeof setTimeout> | null = null;
  let suppress_next_activation = false;
  let dismissed_query: string | null = null;
  let dismissed_from: number | null = null;
  let detach_outside_click: (() => void) | null = null;
  let detach_focus_listener: (() => void) | null = null;

  function get_state(view: EditorView): WikiSuggestState {
    return wiki_suggest_plugin_key.getState(view.state) ?? EMPTY_STATE;
  }

  function dismiss(view: EditorView, lock_query: boolean) {
    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = null;

    const current = get_state(view);
    if (!current.active && current.items.length === 0) return;

    if (lock_query && current.active) {
      dismissed_query = current.query;
      dismissed_from = current.from;
    } else {
      dismissed_query = null;
      dismissed_from = null;
    }

    view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, EMPTY_STATE));
    config.on_dismiss();
    provider?.hide();
  }

  function accept(view: EditorView, index: number) {
    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = null;

    const state = get_state(view);
    const item = state.items[index];
    if (!item) return;
    const target = config.base_note_path
      ? format_wiki_target_for_markdown({
          base_note_path: config.base_note_path,
          resolved_note_path: item.path,
        })
      : item.title;
    const replacement = `[[${target}`;
    const tr = view.state.tr.replaceWith(
      state.from,
      view.state.selection.from,
      view.state.schema.text(replacement),
    );
    tr.setMeta(wiki_suggest_plugin_key, EMPTY_STATE);
    view.dispatch(tr);
    view.focus();
    suppress_next_activation = true;
    dismissed_query = null;
    dismissed_from = null;
    config.on_dismiss();
    provider?.hide();
  }

  function sync_dropdown(view: EditorView, state: WikiSuggestState) {
    if (!dropdown || !provider) return;

    if (!state.active || state.items.length === 0) {
      provider.hide();
      return;
    }

    render_items(dropdown, state.items, state.selected_index, (i) => {
      accept(view, i);
    });

    scroll_selected_item_into_view(dropdown, state.selected_index);
    provider.update(view, undefined);
  }

  return new Plugin<WikiSuggestState>({
    key: wiki_suggest_plugin_key,

    state: {
      init: () => EMPTY_STATE,
      apply(tr, prev) {
        const meta = tr.getMeta(wiki_suggest_plugin_key) as
          | WikiSuggestState
          | { items: SuggestionItem[]; query?: string }
          | undefined;
        if (meta) {
          if ("active" in meta) return meta;
          if ("items" in meta) {
            if (!prev.active) return prev;
            return { ...prev, items: meta.items, selected_index: 0 };
          }
        }
        return prev;
      },
    },

    view(editor_view) {
      dropdown = create_dropdown();

      provider = new TooltipProvider({
        content: dropdown,
        debounce: 16,
        offset: 6,
        root: document.body,
        floatingUIOptions: { placement: "bottom-start" },
        shouldShow: (view) => {
          const state = get_state(view);
          if (!state.active) return false;
          if (state.items.length === 0) return false;
          if (!view.editable) return false;
          if (dropdown?.contains(document.activeElement)) return true;
          return view.hasFocus();
        },
      });

      const on_document_mousedown = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (dropdown?.contains(target)) return;
        if (editor_view.dom.contains(target)) return;
        dismiss(editor_view, true);
      };

      const on_document_focusin = (event: FocusEvent) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (dropdown?.contains(target)) return;
        if (editor_view.dom.contains(target)) return;
        dismiss(editor_view, true);
      };

      document.addEventListener("mousedown", on_document_mousedown, true);
      detach_outside_click = () => {
        document.removeEventListener("mousedown", on_document_mousedown, true);
      };

      document.addEventListener("focusin", on_document_focusin, true);
      detach_focus_listener = () => {
        document.removeEventListener("focusin", on_document_focusin, true);
      };

      return {
        update(view) {
          const { state: editor_state } = view;
          const plugin_state = get_state(view);

          if (!editor_state.selection.empty) {
            if (plugin_state.active) dismiss(view, false);
            sync_dropdown(view, EMPTY_STATE);
            return;
          }

          const $from = editor_state.selection.$from;
          if (
            !$from.parent.isTextblock ||
            $from.parent.type.name === "code_block"
          ) {
            if (plugin_state.active) dismiss(view, false);
            dismissed_query = null;
            dismissed_from = null;
            sync_dropdown(view, EMPTY_STATE);
            return;
          }

          const text_in_block = $from.parent.textBetween(0, $from.parentOffset);
          const result = extract_wiki_query(text_in_block);

          if (!result) {
            if (plugin_state.active) dismiss(view, false);
            dismissed_query = null;
            dismissed_from = null;
            sync_dropdown(view, EMPTY_STATE);
            return;
          }

          const prose_from = $from.start() + result.offset;

          if (
            dismissed_query !== null &&
            dismissed_from !== null &&
            result.query === dismissed_query &&
            prose_from === dismissed_from
          ) {
            if (plugin_state.active) dismiss(view, false);
            sync_dropdown(view, EMPTY_STATE);
            return;
          }

          dismissed_query = null;
          dismissed_from = null;

          if (suppress_next_activation) {
            suppress_next_activation = false;
            if (plugin_state.active) dismiss(view, false);
            sync_dropdown(view, EMPTY_STATE);
            return;
          }

          if (result.query !== plugin_state.query || !plugin_state.active) {
            const new_state: WikiSuggestState = {
              active: true,
              query: result.query,
              from: prose_from,
              items: plugin_state.active ? plugin_state.items : [],
              selected_index: 0,
            };
            view.dispatch(
              view.state.tr.setMeta(wiki_suggest_plugin_key, new_state),
            );

            if (debounce_timer) clearTimeout(debounce_timer);
            debounce_timer = setTimeout(() => {
              config.on_query(result.query);
            }, 50);
          }

          sync_dropdown(view, get_state(view));
        },
        destroy() {
          const el = dropdown;
          dropdown = null;
          el?.remove();
          provider?.destroy();
          provider = null;
          if (debounce_timer) clearTimeout(debounce_timer);
          debounce_timer = null;
          detach_outside_click?.();
          detach_outside_click = null;
          detach_focus_listener?.();
          detach_focus_listener = null;
        },
      };
    },

    props: {
      handleKeyDown(view, event) {
        const state = get_state(view);
        if (!state.active || state.items.length === 0) return false;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          const next = Math.min(
            state.selected_index + 1,
            state.items.length - 1,
          );
          view.dispatch(
            view.state.tr.setMeta(wiki_suggest_plugin_key, {
              ...state,
              selected_index: next,
            }),
          );
          sync_dropdown(view, { ...state, selected_index: next });
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          const prev = Math.max(state.selected_index - 1, 0);
          view.dispatch(
            view.state.tr.setMeta(wiki_suggest_plugin_key, {
              ...state,
              selected_index: prev,
            }),
          );
          sync_dropdown(view, { ...state, selected_index: prev });
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          accept(view, state.selected_index);
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismiss(view, true);
          sync_dropdown(view, EMPTY_STATE);
          return true;
        }

        return false;
      },
    },
  });
}

export function set_wiki_suggestions(
  view: EditorView,
  items: SuggestionItem[],
) {
  view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, { items }));
}

export const wiki_suggest_plugin = $prose((ctx) => {
  const config = ctx.get(wiki_suggest_plugin_config_key.key);
  return create_wiki_suggest_prose_plugin(config);
});
