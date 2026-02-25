import type { NotesPort } from "$lib/ports/notes_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import {
  as_markdown_text,
  as_note_path,
  type MarkdownText,
  type NotePath,
  type AssetPath,
  type VaultId,
} from "$lib/types/ids";
import type { NoteDoc, NoteMeta } from "$lib/types/note";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { AssetsPort } from "$lib/ports/assets_port";
import type {
  NoteDeleteResult,
  NoteOpenResult,
  NoteRenameResult,
  NoteSaveResult,
} from "$lib/types/note_service_result";
import { error_message } from "$lib/utils/error_message";
import {
  ensure_open_note,
  create_untitled_open_note_in_folder,
} from "$lib/domain/ensure_open_note";
import { parent_folder_path } from "$lib/utils/path";
import { resolve_existing_note_path } from "$lib/domain/note_lookup";
import { note_path_exists } from "$lib/domain/note_path_exists";
import type { LinkRepairService } from "$lib/services/link_repair_service";
import type { EditorService } from "$lib/services/editor_service";
import { to_open_note_state, type PastedImagePayload } from "$lib/types/editor";
import { create_write_queue } from "$lib/utils/write_queue";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("note_service");

export class NoteService {
  private readonly enqueue_write = create_write_queue();
  private open_abort: AbortController | null = null;
  private active_save_count = 0;
  private pending_save_error: string | null = null;

  constructor(
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly assets_port: AssetsPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore,
    private readonly editor_service: EditorService,
    private readonly now_ms: () => number,
    private readonly link_repair: LinkRepairService | null = null,
  ) {}

  private async read_or_create_note(
    vault_id: VaultId,
    path: NotePath,
  ): Promise<NoteDoc> {
    try {
      return await this.notes_port.read_note(vault_id, path);
    } catch (read_error) {
      if (!this.is_not_found_error(read_error)) {
        throw read_error;
      }

      try {
        const meta = await this.notes_port.create_note(
          vault_id,
          path,
          as_markdown_text(""),
        );
        await this.index_port.upsert_note(vault_id, meta.id);
        return { meta, markdown: as_markdown_text("") };
      } catch (create_error) {
        if (error_message(create_error).includes("note already exists")) {
          return await this.notes_port.read_note(vault_id, path);
        }
        throw create_error;
      }
    }
  }

  create_new_note(folder_path: string) {
    const open_note = create_untitled_open_note_in_folder({
      notes: this.notes_store.notes,
      folder_prefix: folder_path,
      now_ms: this.now_ms(),
    });

    this.editor_store.set_open_note(open_note);
  }

  async open_note(
    note_path: string,
    create_if_missing: boolean = false,
    options?: { cleanup_if_missing?: boolean; force_reload?: boolean },
  ): Promise<NoteOpenResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    this.open_abort?.abort();
    const controller = new AbortController();
    this.open_abort = controller;

    const op_key = `note.open:${note_path}`;
    this.op_store.start(op_key, this.now_ms());
    let resolved_path: NotePath | null = null;

    try {
      const resolved_existing = create_if_missing
        ? resolve_existing_note_path(this.notes_store.notes, note_path)
        : null;
      resolved_path = as_note_path(resolved_existing ?? note_path);

      const current_open_id = this.editor_store.open_note?.meta.id ?? null;
      if (
        !options?.force_reload &&
        current_open_id &&
        current_open_id === resolved_path
      ) {
        const open_meta = this.editor_store.open_note?.meta;
        if (open_meta && open_meta.path.endsWith(".md")) {
          this.notes_store.add_recent_note(open_meta);
        }
        this.op_store.succeed(op_key);
        return {
          status: "opened",
          selected_folder_path: parent_folder_path(resolved_path),
        };
      }

      const doc = create_if_missing
        ? await this.read_or_create_note(vault_id, resolved_path)
        : await this.notes_port.read_note(vault_id, resolved_path);

      if (controller.signal.aborted) {
        return { status: "skipped" };
      }

      this.notes_store.add_note(doc.meta);
      if (doc.meta.path.endsWith(".md")) {
        this.notes_store.add_recent_note(doc.meta);
      }

      const forced_buffer_id = options?.force_reload
        ? `${doc.meta.id}:reload:${String(this.now_ms())}`
        : undefined;
      this.editor_store.set_open_note(
        to_open_note_state(
          doc,
          forced_buffer_id ? { buffer_id: forced_buffer_id } : undefined,
        ),
      );
      this.op_store.succeed(op_key);

      return {
        status: "opened",
        selected_folder_path: parent_folder_path(resolved_path),
      };
    } catch (error) {
      if (controller.signal.aborted) {
        return { status: "skipped" };
      }
      if (
        options?.cleanup_if_missing &&
        !create_if_missing &&
        resolved_path &&
        this.is_not_found_error(error)
      ) {
        await this.index_port
          .remove_note(vault_id, resolved_path)
          .catch((cleanup_error: unknown) => {
            log.error("Stale index cleanup failed", {
              path: String(resolved_path),
              error: cleanup_error,
            });
          });
        this.notes_store.remove_note(resolved_path);
        this.notes_store.remove_recent_note(resolved_path);
        this.op_store.succeed(op_key);
        return { status: "not_found" };
      }

      const message = error_message(error);
      log.error("Open note failed", { error: message });
      this.op_store.fail(op_key, message);
      return { status: "failed", error: message };
    }
  }

  async open_wiki_link(note_path: string): Promise<NoteOpenResult> {
    if (this.escapes_vault(note_path)) {
      return { status: "failed", error: "Cannot link outside the vault" };
    }
    return this.open_note(note_path, true);
  }

  async save_pasted_image(
    note_path: NotePath,
    image: PastedImagePayload,
    options?: { custom_filename?: string; attachment_folder?: string },
  ): Promise<
    | { status: "saved"; asset_path: AssetPath }
    | { status: "skipped" }
    | { status: "failed"; error: string }
  > {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    this.op_store.start("asset.write", this.now_ms());

    try {
      const input: Parameters<AssetsPort["write_image_asset"]>[1] = {
        note_path,
        image,
      };
      if (options?.custom_filename) {
        input.custom_filename = options.custom_filename;
      }
      if (options?.attachment_folder) {
        input.attachment_folder = options.attachment_folder;
      }
      const asset_path = await this.assets_port.write_image_asset(
        vault_id,
        input,
      );
      this.op_store.succeed("asset.write");
      return {
        status: "saved",
        asset_path,
      };
    } catch (error) {
      const message = error_message(error);
      log.error("Write image asset failed", { error: message });
      this.op_store.fail("asset.write", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async delete_note(note: NoteMeta): Promise<NoteDeleteResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    this.op_store.start("note.delete", this.now_ms());

    try {
      await this.notes_port.delete_note(vault_id, note.id);
      await this.index_port.remove_note(vault_id, note.id);

      const is_open_note = this.editor_store.open_note?.meta.id === note.id;
      this.notes_store.remove_note(note.id);
      this.notes_store.remove_recent_note(note.id);

      const ensured = ensure_open_note({
        vault: this.vault_store.vault,
        notes: this.notes_store.notes,
        open_note: is_open_note ? null : this.editor_store.open_note,
        now_ms: this.now_ms(),
      });

      if (ensured) {
        this.editor_store.set_open_note(ensured);
      } else {
        this.editor_store.clear_open_note();
      }

      this.op_store.succeed("note.delete");
      return { status: "deleted" };
    } catch (error) {
      const message = error_message(error);
      log.error("Delete note failed", { error: message });
      this.op_store.fail("note.delete", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async rename_note(
    note: NoteMeta,
    new_path: NotePath,
    overwrite: boolean,
  ): Promise<NoteRenameResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    const target_exists = note_path_exists(
      this.notes_store.notes,
      new_path,
      note.path,
    );
    if (target_exists && !overwrite) {
      return { status: "conflict" };
    }

    this.op_store.start("note.rename", this.now_ms());

    try {
      await this.rename_note_with_overwrite_if_needed(
        vault_id,
        note.path,
        new_path,
        overwrite,
      );
      await this.index_port.rename_note_path(vault_id, note.id, new_path);

      const path_map = new Map([[note.id as string, new_path as string]]);
      await this.link_repair?.repair_links(vault_id, path_map);

      this.notes_store.rename_note(note.path, new_path);
      const updated_note = this.notes_store.notes.find(
        (entry) => entry.id === new_path,
      );
      if (updated_note) {
        this.notes_store.rename_recent_note(note.id, updated_note);
      } else {
        this.notes_store.remove_recent_note(note.id);
      }

      if (this.editor_store.open_note?.meta.id === note.id) {
        this.editor_store.update_open_note_path(new_path);
      }

      this.op_store.succeed("note.rename");
      return { status: "renamed" };
    } catch (error) {
      if (this.is_note_exists_error(error)) {
        return { status: "conflict" };
      }
      const message = error_message(error);
      log.error("Rename note failed", { error: message });
      this.op_store.fail("note.rename", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async save_note(
    target_path: NotePath | null,
    overwrite: boolean,
  ): Promise<NoteSaveResult> {
    const vault_id = this.vault_store.vault?.id;
    const open_note = this.editor_store.open_note;
    if (!vault_id || !open_note) {
      return { status: "skipped" };
    }

    const flushed = this.editor_service.flush();
    if (flushed && flushed.note_id === open_note.meta.id) {
      this.editor_store.set_markdown(flushed.note_id, flushed.markdown);
    }

    const latest_open_note = this.editor_store.open_note;
    if (!latest_open_note) {
      return { status: "skipped" };
    }

    const is_untitled = !latest_open_note.meta.path.endsWith(".md");
    if (is_untitled) {
      if (!target_path) {
        return { status: "skipped" };
      }

      const target_exists = note_path_exists(
        this.notes_store.notes,
        target_path,
      );
      if (target_exists && !overwrite) {
        return { status: "conflict" };
      }
    }

    this.begin_save_operation();

    try {
      if (is_untitled && target_path) {
        await this.enqueue_write(
          `note.save:${latest_open_note.meta.id}`,
          async () => {
            await this.save_untitled_note(
              vault_id,
              latest_open_note,
              target_path,
              overwrite,
            );
          },
        );
      } else {
        await this.enqueue_write(
          `note.save:${latest_open_note.meta.id}`,
          async () => {
            await this.notes_port.write_note(
              vault_id,
              latest_open_note.meta.id,
              latest_open_note.markdown,
            );
            await this.index_port.upsert_note(
              vault_id,
              latest_open_note.meta.id,
            );
            this.editor_store.mark_clean(
              latest_open_note.meta.id,
              this.now_ms(),
            );
          },
        );
      }

      this.editor_service.mark_clean();
      this.finish_save_operation(null);

      const saved_path =
        this.editor_store.open_note?.meta.path ?? latest_open_note.meta.path;
      return {
        status: "saved",
        saved_path: as_note_path(saved_path),
      };
    } catch (error) {
      if (is_untitled && target_path && this.is_note_exists_error(error)) {
        this.finish_save_operation(null);
        return { status: "conflict" };
      }
      const message = error_message(error);
      log.error("Save note failed", { error: message });
      this.finish_save_operation(message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  reset_save_operation() {
    this.active_save_count = 0;
    this.pending_save_error = null;
    this.op_store.reset("note.save");
  }

  reset_asset_write_operation() {
    this.op_store.reset("asset.write");
  }

  reset_delete_operation() {
    this.op_store.reset("note.delete");
  }

  reset_rename_operation() {
    this.op_store.reset("note.rename");
  }

  private begin_save_operation() {
    if (this.active_save_count === 0) {
      this.pending_save_error = null;
      this.op_store.start("note.save", this.now_ms());
    }
    this.active_save_count += 1;
  }

  private finish_save_operation(error: string | null) {
    if (error) {
      this.pending_save_error = error;
    }

    this.active_save_count = Math.max(0, this.active_save_count - 1);
    if (this.active_save_count > 0) {
      return;
    }

    const final_error = this.pending_save_error;
    this.pending_save_error = null;
    if (final_error) {
      this.op_store.fail("note.save", final_error);
      return;
    }
    this.op_store.succeed("note.save");
  }

  private async save_untitled_note(
    vault_id: VaultId,
    open_note: NonNullable<EditorStore["open_note"]>,
    target_path: NotePath,
    overwrite: boolean,
  ) {
    const old_path = open_note.meta.path;

    try {
      const created_meta = await this.notes_port.create_note(
        vault_id,
        target_path,
        open_note.markdown,
      );
      await this.index_port.upsert_note(vault_id, created_meta.id);
      this.notes_store.add_note(created_meta);
      this.editor_service.rename_buffer(old_path, target_path);
      this.editor_store.update_open_note_path(target_path);
      this.editor_store.mark_clean(target_path, this.now_ms());
      this.notes_store.add_recent_note(created_meta);
      return;
    } catch (error) {
      if (!this.is_note_exists_error(error)) {
        throw error;
      }
      if (!overwrite) {
        throw error;
      }
    }

    await this.notes_port.write_note(vault_id, target_path, open_note.markdown);
    await this.index_port.upsert_note(vault_id, target_path);
    const written = await this.notes_port.read_note(vault_id, target_path);
    this.notes_store.add_note(written.meta);
    this.editor_service.rename_buffer(old_path, target_path);
    this.editor_store.update_open_note_path(target_path);
    this.editor_store.mark_clean(target_path, this.now_ms());
    this.notes_store.add_recent_note(written.meta);
  }

  async write_note_content(note_path: NotePath, markdown: MarkdownText) {
    const vault = this.vault_store.vault;
    if (!vault) return;
    await this.notes_port.write_note(vault.id, note_path, markdown);
  }

  private async rename_note_with_overwrite_if_needed(
    vault_id: VaultId,
    from_path: NotePath,
    to_path: NotePath,
    overwrite: boolean,
  ) {
    try {
      await this.notes_port.rename_note(vault_id, from_path, to_path);
      return;
    } catch (error) {
      if (!overwrite || !this.is_note_exists_error(error)) {
        throw error;
      }
    }

    if (
      this.editor_store.open_note?.meta.id === to_path &&
      this.editor_store.open_note.meta.id !== from_path
    ) {
      throw new Error("cannot overwrite note that is currently open");
    }

    await this.notes_port.delete_note(vault_id, to_path);
    await this.index_port.remove_note(vault_id, to_path);
    this.notes_store.remove_note(to_path);
    this.notes_store.remove_recent_note(to_path);
    await this.notes_port.rename_note(vault_id, from_path, to_path);
  }

  private escapes_vault(path: string): boolean {
    let depth = 0;
    for (const segment of path.split("/")) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") {
        if (depth === 0) return true;
        depth--;
      } else {
        depth++;
      }
    }
    return false;
  }

  private is_not_found_error(error: unknown): boolean {
    if (error instanceof Error && error.name === "NotFoundError") return true;
    const message = error_message(error).toLowerCase();
    return (
      message.includes("not found") ||
      message.includes("no such file") ||
      message.includes("could not be found")
    );
  }

  private is_note_exists_error(error: unknown): boolean {
    const message = error_message(error).toLowerCase();
    return (
      message.includes("note already exists") ||
      message.includes("already exists") ||
      message.includes("destination already exists")
    );
  }
}
