import type { NoteMeta } from "$lib/types/note";
import type { NotePath } from "$lib/types/ids";
import { as_note_path } from "$lib/types/ids";
import { paths_equal_ignore_case } from "$lib/utils/path";

export function note_path_exists(
  notes: NoteMeta[],
  note_path: NotePath,
  exclude_path?: NotePath,
): boolean {
  const normalized = note_path.endsWith(".md")
    ? note_path
    : as_note_path(`${note_path}.md`);
  return notes.some(
    (note) =>
      paths_equal_ignore_case(note.path, normalized) &&
      (!exclude_path || !paths_equal_ignore_case(note.path, exclude_path)),
  );
}
