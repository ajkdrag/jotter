import type { ThemeMode } from "$lib/types/theme";
import type { EditorSettings } from "$lib/types/editor_settings";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/types/editor_settings";
import type { NoteMeta } from "$lib/types/note";
import type { NoteId, NotePath, VaultId } from "$lib/types/ids";
import type {
  FolderLoadState,
  FolderPaginationState,
} from "$lib/types/filetree";
import type { PastedImagePayload } from "$lib/types/editor";
import type { OmnibarScope } from "$lib/types/search";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

type AsyncStatus = "idle" | "loading" | "error";
type SidebarView = "explorer" | "starred";

const INITIAL_DELETE_NOTE_DIALOG = { open: false, note: null } as const;

const INITIAL_RENAME_NOTE_DIALOG = {
  open: false,
  note: null,
  new_name: "",
  show_overwrite_confirm: false,
  is_checking_conflict: false,
} as const;

const INITIAL_SAVE_NOTE_DIALOG = {
  open: false,
  new_path: null,
  folder_path: "",
  show_overwrite_confirm: false,
  is_checking_existence: false,
} as const;

const INITIAL_CREATE_FOLDER_DIALOG = {
  open: false,
  parent_path: "",
  folder_name: "",
} as const;

const INITIAL_DELETE_FOLDER_DIALOG = {
  open: false,
  folder_path: null,
  affected_note_count: 0,
  affected_folder_count: 0,
  status: "idle",
} as const;

const INITIAL_RENAME_FOLDER_DIALOG = {
  open: false,
  folder_path: null,
  new_name: "",
} as const;

const INITIAL_OMNIBAR = {
  open: false,
  query: "",
  selected_index: 0,
  is_searching: false,
  scope: "current_vault",
} as const;

const INITIAL_FIND_IN_FILE = {
  open: false,
  query: "",
  selected_match_index: 0,
} as const;

const INITIAL_IMAGE_PASTE_DIALOG = {
  open: false,
  note_id: null,
  note_path: null,
  image: null,
  filename: "",
  estimated_size_bytes: 0,
  target_folder: "",
} as const;

const INITIAL_CROSS_VAULT_OPEN_CONFIRM = {
  open: false,
  target_vault_id: null,
  target_vault_name: "",
  note_path: null,
} as const;

const INITIAL_VAULT_DASHBOARD = {
  open: false,
} as const;

function initial_filetree() {
  return {
    expanded_paths: new SvelteSet<string>(),
    load_states: new SvelteMap<string, FolderLoadState>(),
    error_messages: new SvelteMap<string, string>(),
    pagination: new SvelteMap<string, FolderPaginationState>(),
  };
}

function initial_settings_dialog(settings: EditorSettings) {
  return {
    open: false,
    current_settings: { ...settings },
    persisted_settings: { ...settings },
    has_unsaved_changes: false,
  };
}

export class UIStore {
  theme = $state<ThemeMode>("system");
  sidebar_open = $state(true);
  sidebar_view = $state<SidebarView>("explorer");
  selected_folder_path = $state("");
  editor_settings = $state<EditorSettings>({ ...DEFAULT_EDITOR_SETTINGS });
  system_dialog_open = $state(false);

  startup = $state<{ status: AsyncStatus; error: string | null }>({
    status: "idle",
    error: null,
  });

  change_vault = $state<{
    open: boolean;
    confirm_discard_open: boolean;
    is_loading: boolean;
    error: string | null;
  }>({
    open: false,
    confirm_discard_open: false,
    is_loading: false,
    error: null,
  });

  delete_note_dialog = $state<{ open: boolean; note: NoteMeta | null }>({
    ...INITIAL_DELETE_NOTE_DIALOG,
  });

  rename_note_dialog = $state<{
    open: boolean;
    note: NoteMeta | null;
    new_name: string;
    show_overwrite_confirm: boolean;
    is_checking_conflict: boolean;
  }>({ ...INITIAL_RENAME_NOTE_DIALOG });

  save_note_dialog = $state<{
    open: boolean;
    new_path: NotePath | null;
    folder_path: string;
    show_overwrite_confirm: boolean;
    is_checking_existence: boolean;
  }>({ ...INITIAL_SAVE_NOTE_DIALOG });

  create_folder_dialog = $state<{
    open: boolean;
    parent_path: string;
    folder_name: string;
  }>({ ...INITIAL_CREATE_FOLDER_DIALOG });

  delete_folder_dialog = $state<{
    open: boolean;
    folder_path: string | null;
    affected_note_count: number;
    affected_folder_count: number;
    status: "idle" | "fetching_stats" | "confirming" | "error";
  }>({ ...INITIAL_DELETE_FOLDER_DIALOG });

  rename_folder_dialog = $state<{
    open: boolean;
    folder_path: string | null;
    new_name: string;
  }>({ ...INITIAL_RENAME_FOLDER_DIALOG });

  settings_dialog = $state<{
    open: boolean;
    current_settings: EditorSettings;
    persisted_settings: EditorSettings;
    has_unsaved_changes: boolean;
  }>(initial_settings_dialog(DEFAULT_EDITOR_SETTINGS));

  omnibar = $state<{
    open: boolean;
    query: string;
    selected_index: number;
    is_searching: boolean;
    scope: OmnibarScope;
  }>({ ...INITIAL_OMNIBAR });

  find_in_file = $state<{
    open: boolean;
    query: string;
    selected_match_index: number;
  }>({ ...INITIAL_FIND_IN_FILE });

  filetree = $state<{
    expanded_paths: SvelteSet<string>;
    load_states: SvelteMap<string, FolderLoadState>;
    error_messages: SvelteMap<string, string>;
    pagination: SvelteMap<string, FolderPaginationState>;
  }>(initial_filetree());

  image_paste_dialog = $state<{
    open: boolean;
    note_id: NoteId | null;
    note_path: NotePath | null;
    image: PastedImagePayload | null;
    filename: string;
    estimated_size_bytes: number;
    target_folder: string;
  }>({ ...INITIAL_IMAGE_PASTE_DIALOG });

  cross_vault_open_confirm = $state<{
    open: boolean;
    target_vault_id: VaultId | null;
    target_vault_name: string;
    note_path: NotePath | null;
  }>({ ...INITIAL_CROSS_VAULT_OPEN_CONFIRM });

  vault_dashboard = $state<{
    open: boolean;
  }>({ ...INITIAL_VAULT_DASHBOARD });

  set_theme(theme: ThemeMode) {
    this.theme = theme;
  }

  toggle_sidebar() {
    this.sidebar_open = !this.sidebar_open;
  }

  set_sidebar_view(view: SidebarView) {
    this.sidebar_view = view;
    this.sidebar_open = true;
  }

  set_selected_folder_path(path: string) {
    this.selected_folder_path = path;
  }

  set_editor_settings(settings: EditorSettings) {
    this.editor_settings = settings;
    this.settings_dialog.current_settings = settings;
  }

  set_system_dialog_open(open: boolean) {
    this.system_dialog_open = open;
  }

  reset_for_new_vault() {
    this.selected_folder_path = "";
    this.delete_note_dialog = { ...INITIAL_DELETE_NOTE_DIALOG };
    this.rename_note_dialog = { ...INITIAL_RENAME_NOTE_DIALOG };
    this.save_note_dialog = { ...INITIAL_SAVE_NOTE_DIALOG };
    this.create_folder_dialog = { ...INITIAL_CREATE_FOLDER_DIALOG };
    this.delete_folder_dialog = { ...INITIAL_DELETE_FOLDER_DIALOG };
    this.rename_folder_dialog = { ...INITIAL_RENAME_FOLDER_DIALOG };
    this.settings_dialog = initial_settings_dialog(this.editor_settings);
    this.omnibar = { ...INITIAL_OMNIBAR };
    this.find_in_file = { ...INITIAL_FIND_IN_FILE };
    this.filetree = initial_filetree();
    this.image_paste_dialog = { ...INITIAL_IMAGE_PASTE_DIALOG };
    this.cross_vault_open_confirm = { ...INITIAL_CROSS_VAULT_OPEN_CONFIRM };
    this.vault_dashboard = { ...INITIAL_VAULT_DASHBOARD };
  }
}
