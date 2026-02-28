import { $prose } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import type { PastedImagePayload } from "$lib/shared/types/editor";

function first_image_file(data: DataTransfer | null): File | null {
  if (!data) return null;

  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    if (!item.type.toLowerCase().startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

export function create_image_paste_plugin(
  on_image_paste_requested: (payload: PastedImagePayload) => void,
) {
  return $prose(
    () =>
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const editable = view.props.editable?.(view.state);
            if (!editable) return false;

            const current_node = view.state.selection.$from.node();
            if (current_node.type.spec.code) return false;

            const file = first_image_file(event.clipboardData);
            if (!file) return false;

            event.preventDefault();

            void file
              .arrayBuffer()
              .then((buffer) => {
                on_image_paste_requested({
                  bytes: new Uint8Array(buffer),
                  mime_type: file.type || "application/octet-stream",
                  file_name: file.name || null,
                });
              })
              .catch(() => {});

            return true;
          },
        },
      }),
  );
}
