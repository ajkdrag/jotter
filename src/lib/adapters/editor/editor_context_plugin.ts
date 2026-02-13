import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import type { EditorSettings } from "$lib/types/editor_settings";

export type EditorContextState = {
  note_path: string;
  link_syntax: EditorSettings["link_syntax"];
};

type EditorContextMeta = {
  action: "update";
  note_path: string;
  link_syntax: EditorSettings["link_syntax"];
};

function is_update_action(value: unknown): value is EditorContextMeta {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.action === "update";
}

export const editor_context_plugin_key = new PluginKey<EditorContextState>(
  "editor-context",
);

export function create_editor_context_prose_plugin(
  initial: EditorContextState,
) {
  return new Plugin<EditorContextState>({
    key: editor_context_plugin_key,
    state: {
      init() {
        return { ...initial };
      },
      apply(tr, value) {
        const meta = tr.getMeta(editor_context_plugin_key) as unknown;
        if (is_update_action(meta)) {
          return {
            note_path: meta.note_path,
            link_syntax: meta.link_syntax,
          };
        }
        return value;
      },
    },
  });
}

export const create_editor_context_plugin = (initial: EditorContextState) =>
  $prose(() => create_editor_context_prose_plugin(initial));
