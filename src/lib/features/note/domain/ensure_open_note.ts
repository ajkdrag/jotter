import type { OpenNoteState } from "$lib/shared/types/editor";
import type { Vault } from "$lib/shared/types/vault";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";

const UNTITLED_PATTERN = /^Untitled-(\d+)$/;

function next_untitled_name(open_names: string[]): string {
  let max = 0;

  for (const name of open_names) {
    const match = name.match(UNTITLED_PATTERN);
    if (!match) continue;
    const value = Number(match[1]);
    if (value > max) max = value;
  }
  return `Untitled-${String(max + 1)}`;
}

export function create_untitled_open_note(args: {
  open_names: string[];
  now_ms: number;
}): OpenNoteState {
  const name = next_untitled_name(args.open_names);

  return {
    meta: {
      id: as_note_path(name),
      path: as_note_path(name),
      name,
      title: name,
      mtime_ms: args.now_ms,
      size_bytes: 0,
    },
    markdown: as_markdown_text(""),
    buffer_id: `untitled:${String(args.now_ms)}:${name}`,
    is_dirty: false,
  };
}

export function ensure_open_note(args: {
  vault: Vault | null;
  open_names: string[];
  open_note: OpenNoteState | null;
  now_ms: number;
}): OpenNoteState | null {
  if (!args.vault) return args.open_note;
  if (args.open_note) return args.open_note;
  return create_untitled_open_note({
    open_names: args.open_names,
    now_ms: args.now_ms,
  });
}
