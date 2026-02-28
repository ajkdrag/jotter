import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

const mark_escape_plugin_key = new PluginKey("mark-escape");

export const mark_escape_plugin = $prose(
  () =>
    new Plugin({
      key: mark_escape_plugin_key,
      props: {
        handleKeyDown(view, event) {
          if (event.key !== "ArrowRight") return false;

          const { state } = view;
          const { selection } = state;
          if (!(selection instanceof TextSelection) || !selection.empty)
            return false;

          const $cursor = selection.$cursor;
          if (!$cursor) return false;

          const marks = state.storedMarks ?? $cursor.marks();
          const non_inclusive = marks.filter(
            (m) => m.type.spec.inclusive === false,
          );
          if (non_inclusive.length === 0) return false;

          const node_after = $cursor.nodeAfter;
          const at_boundary = non_inclusive.some(
            (m) => !node_after || !m.type.isInSet(node_after.marks),
          );
          if (!at_boundary) return false;

          let tr = state.tr;
          for (const m of non_inclusive) {
            tr = tr.removeStoredMark(m.type);
          }
          view.dispatch(tr);

          return false;
        },
      },
    }),
);
