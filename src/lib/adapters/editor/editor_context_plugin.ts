import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

export type EditorContextState = {
  note_path: string;
};

type EditorContextMeta = {
  action: "update";
  note_path: string;
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
          };
        }
        return value;
      },
    },
  });
}

export const create_editor_context_plugin = (initial: EditorContextState) =>
  $prose(() => create_editor_context_prose_plugin(initial));
