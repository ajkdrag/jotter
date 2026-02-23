import type { NoteMeta } from "$lib/types/note";

export type FolderLoadState = "unloaded" | "loading" | "loaded" | "error";

export type FlatTreeNode = {
  id: string;
  path: string;
  name: string;
  depth: number;
  is_folder: boolean;
  is_expanded: boolean;
  is_loading: boolean;
  has_error: boolean;
  error_message: string | null;
  note: NoteMeta | null;
  parent_path: string | null;
  is_load_more: boolean;
};

export type FolderContents = {
  notes: NoteMeta[];
  subfolders: string[];
  total_count: number;
  has_more: boolean;
};

export type FolderPaginationState = {
  loaded_count: number;
  total_count: number;
  load_state: "idle" | "loading" | "error";
  error_message: string | null;
};

export type MoveItem = {
  path: string;
  is_folder: boolean;
};

export type MoveItemResult = {
  path: string;
  new_path: string;
  success: boolean;
  error: string | null;
};
