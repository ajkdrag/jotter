import type { MarkdownText, NoteId, NotePath } from "$lib/shared/types/ids";

export type NoteMeta = {
  id: NoteId;
  path: NotePath;
  name: string;
  title: string;
  mtime_ms: number;
  size_bytes: number;
};

export type NoteDoc = {
  meta: NoteMeta;
  markdown: MarkdownText;
};
