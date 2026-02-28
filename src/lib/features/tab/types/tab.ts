import type { NotePath } from "$lib/shared/types/ids";
import type { CursorInfo } from "$lib/shared/types/editor";

export type TabId = string;

export type Tab = {
  id: TabId;
  note_path: NotePath;
  title: string;
  is_pinned: boolean;
  is_dirty: boolean;
};

export type TabEditorSnapshot = {
  scroll_top: number;
  cursor: CursorInfo | null;
};

export type ClosedTabEntry = {
  note_path: NotePath;
  title: string;
  scroll_top: number;
  cursor: CursorInfo | null;
};

export type PersistedTab = {
  note_path: NotePath;
  is_pinned: boolean;
  cursor: CursorInfo | null;
};

export type PersistedTabState = {
  tabs: PersistedTab[];
  active_tab_path: NotePath | null;
};
