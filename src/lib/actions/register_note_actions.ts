import { ACTION_IDS } from "$lib/actions/action_ids";
import type { ActionRegistrationInput } from "$lib/actions/action_registration_input";
import {
  capture_active_tab_snapshot,
  ensure_tab_capacity,
  try_open_tab,
} from "$lib/actions/register_tab_actions";
import { clear_folder_filetree_state } from "$lib/actions/filetree_state";
import type { NoteMeta } from "$lib/types/note";
import { as_note_path, type NoteId, type NotePath } from "$lib/types/ids";
import type { ImagePasteRequest, PastedImagePayload } from "$lib/types/editor";
import { sanitize_note_name } from "$lib/domain/sanitize_note_name";
import { to_markdown_asset_target } from "$lib/domain/asset_markdown_path";
import { note_name_from_path, parent_folder_path } from "$lib/utils/path";
import { toast } from "svelte-sonner";

function close_delete_dialog(input: ActionRegistrationInput) {
  input.stores.ui.delete_note_dialog = {
    open: false,
    note: null,
  };
}

function close_rename_dialog(input: ActionRegistrationInput) {
  input.stores.ui.rename_note_dialog = {
    open: false,
    note: null,
    new_name: "",
    show_overwrite_confirm: false,
    is_checking_conflict: false,
  };
}

function close_save_dialog(input: ActionRegistrationInput) {
  input.stores.ui.save_note_dialog = {
    open: false,
    folder_path: "",
    new_path: null,
    show_overwrite_confirm: false,
    is_checking_existence: false,
  };
}

function build_full_path(folder_path: string, filename: string): NotePath {
  const sanitized = sanitize_note_name(filename);
  return as_note_path(folder_path ? `${folder_path}/${sanitized}` : sanitized);
}

function filename_from_path(path: string): string {
  const last_slash = path.lastIndexOf("/");
  return last_slash >= 0 ? path.slice(last_slash + 1) : path;
}

function build_note_path_from_name(parent: string, name: string): NotePath {
  const filename = `${name}.md`;
  return as_note_path(parent ? `${parent}/${filename}` : filename);
}

function image_alt_text(file_name: string | null): string {
  if (!file_name) return "image";
  const leaf = file_name.split("/").filter(Boolean).at(-1) ?? "";
  const stem = leaf.replace(/\.[^.]+$/i, "").trim();
  return stem !== "" ? stem : "image";
}

function close_image_paste_dialog(input: ActionRegistrationInput) {
  input.stores.ui.image_paste_dialog = {
    open: false,
    note_id: null,
    note_path: null,
    image: null,
    filename: "",
    estimated_size_bytes: 0,
    target_folder: "",
  };
}

function parse_note_open_input(input: unknown): {
  note_path: string;
  cleanup_if_missing: boolean;
} {
  if (input && typeof input === "object" && "note_path" in input) {
    const record = input as Record<string, unknown>;
    if (typeof record.note_path === "string") {
      return {
        note_path: record.note_path,
        cleanup_if_missing: record.cleanup_if_missing === true,
      };
    }
  }

  return {
    note_path: String(input),
    cleanup_if_missing: false,
  };
}

async function save_and_insert_image(
  input: ActionRegistrationInput,
  note_id: NoteId,
  note_path: NotePath,
  image: PastedImagePayload,
  options?: { custom_filename?: string; attachment_folder?: string },
): Promise<void> {
  const { stores, services } = input;

  const write_result = await services.note.save_pasted_image(
    note_path,
    image,
    options,
  );
  if (write_result.status !== "saved") return;

  const latest_open_note = stores.editor.open_note;
  if (!latest_open_note || latest_open_note.meta.id !== note_id) return;

  const target = to_markdown_asset_target(note_path, write_result.asset_path);
  const alt = image_alt_text(image.file_name);
  services.editor.insert_text(`![${alt}](${target})`);
}

export function register_note_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  registry.register({
    id: ACTION_IDS.note_create,
    label: "Create Note",
    shortcut: "CmdOrCtrl+N",
    when: () => stores.vault.vault !== null,
    execute: async (folder_prefix?: unknown) => {
      const folder_path =
        typeof folder_prefix === "string" && folder_prefix.length > 0
          ? folder_prefix
          : stores.ui.selected_folder_path;

      if (!ensure_tab_capacity(input)) return;

      await capture_active_tab_snapshot(input);

      services.note.create_new_note(folder_path);
      stores.ui.set_selected_folder_path(folder_path);

      const open_note = stores.editor.open_note;
      if (open_note) {
        const tab = stores.tab.open_tab(
          open_note.meta.path,
          open_note.meta.title || "Untitled",
        );
        stores.tab.set_cached_note(tab.id, open_note);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_open,
    label: "Open Note",
    when: () => stores.vault.vault !== null,
    execute: async (note_input: unknown) => {
      const parsed = parse_note_open_input(note_input);
      const note_path = parsed.note_path;

      const existing_tab = stores.tab.find_tab_by_path(note_path as NotePath);
      if (existing_tab) {
        if (stores.tab.active_tab_id !== existing_tab.id) {
          await capture_active_tab_snapshot(input);
          stores.tab.activate_tab(existing_tab.id);
        }
        const result = await services.note.open_note(note_path, false, {
          cleanup_if_missing: parsed.cleanup_if_missing,
        });
        if (result.status === "opened") {
          stores.ui.set_selected_folder_path(result.selected_folder_path);
        }
        return;
      }

      if (!ensure_tab_capacity(input)) return;

      await capture_active_tab_snapshot(input);

      const result = await services.note.open_note(note_path, false, {
        cleanup_if_missing: parsed.cleanup_if_missing,
      });
      if (result.status === "opened") {
        const title = note_name_from_path(note_path);
        const tab = stores.tab.open_tab(note_path as NotePath, title);
        stores.ui.set_selected_folder_path(result.selected_folder_path);
        const open_note = stores.editor.open_note;
        if (open_note) {
          stores.tab.set_cached_note(tab.id, open_note);
        }
      }
      if (result.status === "not_found") {
        toast.error("Note no longer exists");
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_open_wiki_link,
    label: "Open Wiki Link",
    when: () => stores.vault.vault !== null,
    execute: async (note_path: unknown) => {
      const path_str = String(note_path);

      const existing_tab = stores.tab.find_tab_by_path(path_str as NotePath);
      if (!existing_tab && !ensure_tab_capacity(input)) return;

      await capture_active_tab_snapshot(input);

      const result = await services.note.open_wiki_link(path_str);
      if (result.status === "opened") {
        const opened_path = stores.editor.open_note?.meta.path ?? path_str;
        const title = note_name_from_path(opened_path);
        const tab = try_open_tab(input, opened_path as NotePath, title);
        if (!tab) return;
        stores.ui.set_selected_folder_path(result.selected_folder_path);
        clear_folder_filetree_state(input, result.selected_folder_path);
        const open_note = stores.editor.open_note;
        if (open_note) {
          stores.tab.set_cached_note(tab.id, open_note);
        }
      }
      if (result.status === "failed") {
        toast.error(result.error);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_copy_markdown,
    label: "Copy Markdown",
    execute: async () => {
      await services.clipboard.copy_open_note_markdown();
    },
  });

  registry.register({
    id: ACTION_IDS.note_insert_pasted_image,
    label: "Insert Pasted Image",
    when: () => stores.vault.vault !== null,
    execute: async (request: unknown) => {
      const payload = request as ImagePasteRequest;
      const open_note = stores.editor.open_note;
      if (!open_note || open_note.meta.id !== payload.note_id) return;

      await save_and_insert_image(
        input,
        payload.note_id,
        payload.note_path,
        payload.image,
      );
    },
  });

  registry.register({
    id: ACTION_IDS.note_request_image_paste,
    label: "Request Image Paste",
    when: () => stores.vault.vault !== null,
    execute: (request: unknown) => {
      const payload = request as ImagePasteRequest;
      const open_note = stores.editor.open_note;
      if (!open_note) return;
      if (open_note.meta.id !== payload.note_id) return;

      const estimated_size_bytes = payload.image.bytes.byteLength;
      const target_folder =
        stores.ui.editor_settings.attachment_folder || ".assets";

      stores.ui.image_paste_dialog = {
        open: true,
        note_id: payload.note_id,
        note_path: payload.note_path,
        image: payload.image,
        filename: "",
        estimated_size_bytes,
        target_folder,
      };
      services.note.reset_asset_write_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_update_image_paste_filename,
    label: "Update Image Paste Filename",
    execute: (filename: unknown) => {
      stores.ui.image_paste_dialog.filename = String(filename);
    },
  });

  registry.register({
    id: ACTION_IDS.note_confirm_image_paste,
    label: "Confirm Image Paste",
    execute: async () => {
      const dialog = stores.ui.image_paste_dialog;
      if (!dialog.open || !dialog.note_id || !dialog.note_path || !dialog.image)
        return;

      const open_note = stores.editor.open_note;
      if (!open_note || open_note.meta.id !== dialog.note_id) return;

      const attachment_folder =
        stores.ui.editor_settings.attachment_folder || ".assets";
      const custom_filename = dialog.filename.trim();

      await save_and_insert_image(
        input,
        dialog.note_id,
        dialog.note_path,
        dialog.image,
        {
          ...(custom_filename ? { custom_filename } : {}),
          attachment_folder,
        },
      );

      close_image_paste_dialog(input);
    },
  });

  registry.register({
    id: ACTION_IDS.note_cancel_image_paste,
    label: "Cancel Image Paste",
    execute: () => {
      close_image_paste_dialog(input);
      services.note.reset_asset_write_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_request_delete,
    label: "Request Delete Note",
    execute: (note: unknown) => {
      stores.ui.delete_note_dialog = {
        open: true,
        note: note as NoteMeta,
      };
      services.note.reset_delete_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_confirm_delete,
    label: "Confirm Delete Note",
    execute: async () => {
      const note = stores.ui.delete_note_dialog.note;
      if (!note) return;

      const tab = stores.tab.find_tab_by_path(note.path);
      if (tab) {
        stores.tab.close_tab(tab.id);
      }

      const result = await services.note.delete_note(note);
      if (result.status === "deleted") {
        clear_folder_filetree_state(input, parent_folder_path(note.path));
        close_delete_dialog(input);

        const active_tab = stores.tab.active_tab;
        if (active_tab) {
          await services.note.open_note(active_tab.note_path, false);
        }
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_cancel_delete,
    label: "Cancel Delete Note",
    execute: () => {
      close_delete_dialog(input);
      services.note.reset_delete_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_request_rename,
    label: "Request Rename Note",
    execute: (note: unknown) => {
      const note_meta = note as NoteMeta;
      stores.ui.rename_note_dialog = {
        open: true,
        note: note_meta,
        new_name: note_name_from_path(note_meta.path),
        show_overwrite_confirm: false,
        is_checking_conflict: false,
      };
      services.note.reset_rename_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_update_rename_name,
    label: "Update Rename Note Name",
    execute: (name: unknown) => {
      stores.ui.rename_note_dialog.new_name = String(name);
      stores.ui.rename_note_dialog.show_overwrite_confirm = false;
    },
  });

  registry.register({
    id: ACTION_IDS.note_confirm_rename,
    label: "Confirm Rename Note",
    execute: async () => {
      const note = stores.ui.rename_note_dialog.note;
      const new_name = stores.ui.rename_note_dialog.new_name.trim();
      if (!note || !new_name) return;

      const parent = parent_folder_path(note.path);
      const new_path = build_note_path_from_name(parent, new_name);

      stores.ui.rename_note_dialog.is_checking_conflict = true;
      const result = await services.note.rename_note(note, new_path, false);
      stores.ui.rename_note_dialog.is_checking_conflict = false;

      if (result.status === "conflict") {
        stores.ui.rename_note_dialog.show_overwrite_confirm = true;
        return;
      }

      if (result.status === "renamed") {
        stores.tab.update_tab_path(note.path, new_path);
        clear_folder_filetree_state(input, parent);
        const new_parent = parent_folder_path(new_path);
        if (new_parent !== parent) {
          clear_folder_filetree_state(input, new_parent);
        }
        close_rename_dialog(input);
      }
    },
  });

  async function force_rename_note() {
    const note = stores.ui.rename_note_dialog.note;
    const new_name = stores.ui.rename_note_dialog.new_name.trim();
    if (!note || !new_name) return;

    const parent = parent_folder_path(note.path);
    const new_path = build_note_path_from_name(parent, new_name);

    const result = await services.note.rename_note(note, new_path, true);
    if (result.status === "renamed") {
      stores.tab.update_tab_path(note.path, new_path);
      clear_folder_filetree_state(input, parent);
      const new_parent = parent_folder_path(new_path);
      if (new_parent !== parent) {
        clear_folder_filetree_state(input, new_parent);
      }
      close_rename_dialog(input);
    }
  }

  registry.register({
    id: ACTION_IDS.note_confirm_rename_overwrite,
    label: "Confirm Rename Note Overwrite",
    execute: force_rename_note,
  });

  registry.register({
    id: ACTION_IDS.note_cancel_rename,
    label: "Cancel Rename Note",
    execute: () => {
      close_rename_dialog(input);
      services.note.reset_rename_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_retry_rename,
    label: "Retry Rename Note",
    execute: force_rename_note,
  });

  registry.register({
    id: ACTION_IDS.note_request_save,
    label: "Save Note",
    shortcut: "CmdOrCtrl+S",
    when: () => stores.vault.vault !== null,
    execute: async () => {
      const open_note = stores.editor.open_note;
      if (!open_note) return;

      const is_untitled = !open_note.meta.path.endsWith(".md");
      if (!is_untitled) {
        await services.note.save_note(null, true);
        return;
      }

      const folder_path = stores.ui.selected_folder_path;
      const filename = filename_from_path(open_note.meta.path) || "Untitled";

      stores.ui.save_note_dialog = {
        open: true,
        folder_path,
        new_path: build_full_path(folder_path, filename),
        show_overwrite_confirm: false,
        is_checking_existence: false,
      };
      services.note.reset_save_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_update_save_path,
    label: "Update Save Note Path",
    execute: (path: unknown) => {
      stores.ui.save_note_dialog.new_path = as_note_path(String(path));
      stores.ui.save_note_dialog.show_overwrite_confirm = false;
    },
  });

  registry.register({
    id: ACTION_IDS.note_confirm_save,
    label: "Confirm Save Note",
    execute: async () => {
      if (!stores.ui.save_note_dialog.open) {
        await services.note.save_note(null, true);
        return;
      }

      const path = stores.ui.save_note_dialog.new_path;
      if (!path) return;

      stores.ui.save_note_dialog.is_checking_existence = true;
      const result = await services.note.save_note(path, false);
      stores.ui.save_note_dialog.is_checking_existence = false;

      if (result.status === "conflict") {
        stores.ui.save_note_dialog.show_overwrite_confirm = true;
        return;
      }

      if (result.status === "saved") {
        if (stores.tab.active_tab_id && result.saved_path) {
          stores.tab.update_tab_path(
            stores.tab.active_tab_id as NotePath,
            result.saved_path,
          );
        }
        clear_folder_filetree_state(
          input,
          parent_folder_path(result.saved_path),
        );
        close_save_dialog(input);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_confirm_save_overwrite,
    label: "Confirm Save Note Overwrite",
    execute: async () => {
      const path = stores.ui.save_note_dialog.new_path;
      if (!path) return;

      const result = await services.note.save_note(path, true);
      if (result.status === "saved") {
        if (stores.tab.active_tab_id && result.saved_path) {
          stores.tab.update_tab_path(
            stores.tab.active_tab_id as NotePath,
            result.saved_path,
          );
        }
        clear_folder_filetree_state(
          input,
          parent_folder_path(result.saved_path),
        );
        close_save_dialog(input);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_retry_save,
    label: "Retry Save Note",
    execute: async () => {
      const path = stores.ui.save_note_dialog.open
        ? stores.ui.save_note_dialog.new_path
        : null;
      const result = await services.note.save_note(path, true);
      if (result.status === "saved" && stores.ui.save_note_dialog.open) {
        clear_folder_filetree_state(
          input,
          parent_folder_path(result.saved_path),
        );
        close_save_dialog(input);
      }
    },
  });

  registry.register({
    id: ACTION_IDS.note_cancel_save,
    label: "Cancel Save Note",
    execute: () => {
      close_save_dialog(input);
      services.note.reset_save_operation();
    },
  });

  registry.register({
    id: ACTION_IDS.note_toggle_star,
    label: "Toggle Star",
    execute: (note: unknown) => {
      const note_path =
        typeof note === "string"
          ? note
          : (note as NoteMeta | null | undefined)?.path;
      if (!note_path) return;
      stores.notes.toggle_star_path(note_path);
    },
  });
}
