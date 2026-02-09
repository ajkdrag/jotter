import type { EditorSettings } from "$lib/types/editor_settings";
import type { VaultId } from "$lib/types/ids";
import type { CursorInfo, PastedImagePayload } from "$lib/types/editor";

export type EditorSession = {
  destroy: () => void;
  set_markdown: (markdown: string) => void;
  get_markdown: () => string;
  insert_text_at_cursor: (text: string) => void;
  mark_clean: () => void;
  is_dirty: () => boolean;
  focus: () => void;
  set_wiki_suggestions?: (
    items: Array<{ title: string; path: string }>,
  ) => void;
};

export type EditorEventHandlers = {
  on_markdown_change: (markdown: string) => void;
  on_dirty_state_change: (is_dirty: boolean) => void;
  on_cursor_change?: (info: CursorInfo) => void;
  on_internal_link_click?: (note_path: string) => void;
  on_image_paste_requested?: (payload: PastedImagePayload) => void;
  on_wiki_suggest_query?: (query: string) => void;
};

export type EditorSessionConfig = {
  root: HTMLElement;
  initial_markdown: string;
  note_path: string;
  vault_id: VaultId | null;
  link_syntax: EditorSettings["link_syntax"];
  events: EditorEventHandlers;
};

export interface EditorPort {
  start_session: (config: EditorSessionConfig) => Promise<EditorSession>;
}
