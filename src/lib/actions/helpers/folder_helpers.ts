import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";

export function close_create_dialog(input: ActionRegistrationInput) {
  input.stores.ui.create_folder_dialog = {
    open: false,
    parent_path: "",
    folder_name: "",
  };
}

export function close_delete_dialog(input: ActionRegistrationInput) {
  input.stores.ui.delete_folder_dialog = {
    open: false,
    folder_path: null,
    affected_note_count: 0,
    affected_folder_count: 0,
    status: "idle",
  };
}

export function close_rename_dialog(input: ActionRegistrationInput) {
  input.stores.ui.rename_folder_dialog = {
    open: false,
    folder_path: null,
    new_name: "",
  };
}

export function folder_name_from_path(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

export function build_folder_path_from_name(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function parse_reveal_note_path(input: unknown): string {
  if (input && typeof input === "object" && "note_path" in input) {
    const record = input as Record<string, unknown>;
    if (typeof record.note_path === "string") {
      return record.note_path;
    }
  }
  return String(input);
}

export function ancestor_folder_paths(note_path: string): string[] {
  const segments = note_path.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return [];
  }

  const folders = segments.slice(0, -1);
  const result: string[] = [];
  for (let i = 0; i < folders.length; i += 1) {
    result.push(folders.slice(0, i + 1).join("/"));
  }
  return result;
}

export function is_valid_folder_name(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.includes("/") &&
    trimmed !== "." &&
    trimmed !== ".."
  );
}
