import {
  format_wiki_target_for_markdown_link,
  resolve_wiki_target_to_note_path,
} from "$lib/domain/wiki_link";

const INTERNAL_MARKDOWN_LINK_REGEX =
  /(?<!!)\[([^\]]*)\]\((?!https?:\/\/)([^)]+\.md)\)/g;

export type RewriteNoteLinksInput = {
  source_note_path: string;
  markdown: string;
  old_target_path: string;
  new_target_path: string;
};

export type RewriteNoteLinksResult = {
  markdown: string;
  changed: boolean;
};

export function rewrite_note_links(
  input: RewriteNoteLinksInput,
): RewriteNoteLinksResult {
  let changed = false;
  const rewritten = input.markdown.replace(
    INTERNAL_MARKDOWN_LINK_REGEX,
    (full_match, label: string, raw_target: string) => {
      const resolved = resolve_wiki_target_to_note_path({
        base_note_path: input.source_note_path,
        raw_target: raw_target.trim(),
      });
      if (!resolved || resolved !== input.old_target_path) {
        return full_match;
      }

      changed = true;
      const href = format_wiki_target_for_markdown_link({
        base_note_path: input.source_note_path,
        resolved_note_path: input.new_target_path,
      });
      return `[${label}](${href})`;
    },
  );

  return {
    markdown: rewritten,
    changed,
  };
}
