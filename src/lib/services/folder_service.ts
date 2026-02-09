import type { NotesPort } from "$lib/ports/notes_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type {
  FolderDeleteStatsResult,
  FolderLoadResult,
  FolderMutationResult,
} from "$lib/types/folder_service_result";
import { PAGE_SIZE } from "$lib/constants/pagination";
import { error_message } from "$lib/utils/error_message";
import { ensure_open_note } from "$lib/utils/ensure_open_note";
import { logger } from "$lib/utils/logger";

export class FolderService {
  constructor(
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  async create_folder(
    parent_path: string,
    folder_name: string,
  ): Promise<FolderMutationResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    const trimmed_name = folder_name.trim();
    if (!trimmed_name) {
      return { status: "skipped" };
    }

    this.op_store.start("folder.create");

    try {
      await this.notes_port.create_folder(vault_id, parent_path, trimmed_name);
      const new_folder_path = parent_path
        ? `${parent_path}/${trimmed_name}`
        : trimmed_name;
      this.notes_store.add_folder_path(new_folder_path);
      this.op_store.succeed("folder.create");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Create folder failed: ${message}`);
      this.op_store.fail("folder.create", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async load_delete_stats(
    folder_path: string,
  ): Promise<FolderDeleteStatsResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    try {
      const stats = await this.notes_port.get_folder_stats(
        vault_id,
        folder_path,
      );
      return {
        status: "ready",
        affected_note_count: stats.note_count,
        affected_folder_count: stats.folder_count,
      };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Load folder delete stats failed: ${message}`);
      this.op_store.fail("folder.delete", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async delete_folder(folder_path: string): Promise<FolderMutationResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id || !folder_path) {
      return { status: "skipped" };
    }

    this.op_store.start("folder.delete");

    try {
      const folder_prefix = `${folder_path}/`;
      const contains_open_note =
        this.editor_store.open_note?.meta.path.startsWith(folder_prefix) ??
        false;

      const result = await this.notes_port.delete_folder(vault_id, folder_path);

      if (result.deleted_notes.length > 0) {
        await this.index_port.remove_notes(vault_id, result.deleted_notes);
      }

      this.notes_store.remove_folder(folder_path);

      const ensured = ensure_open_note({
        vault: this.vault_store.vault,
        notes: this.notes_store.notes,
        open_note: contains_open_note ? null : this.editor_store.open_note,
        now_ms: this.now_ms(),
      });

      if (ensured) {
        this.editor_store.set_open_note(ensured);
      } else {
        this.editor_store.clear_open_note();
      }

      this.op_store.succeed("folder.delete");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Delete folder failed: ${message}`);
      this.op_store.fail("folder.delete", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async rename_folder(
    folder_path: string,
    new_path: string,
  ): Promise<FolderMutationResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id || !folder_path || !new_path) {
      return { status: "skipped" };
    }

    this.op_store.start("folder.rename");

    try {
      const old_prefix = `${folder_path}/`;
      const new_prefix = `${new_path}/`;
      const has_affected_notes = this.notes_store.notes.some((note) =>
        note.path.startsWith(old_prefix),
      );

      await this.notes_port.rename_folder(vault_id, folder_path, new_path);
      if (has_affected_notes) {
        await this.index_port.build_index(vault_id);
      }

      this.notes_store.rename_folder(folder_path, new_path);
      this.editor_store.update_open_note_path_prefix(old_prefix, new_prefix);
      this.op_store.succeed("folder.rename");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Rename folder failed: ${message}`);
      this.op_store.fail("folder.rename", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async load_folder(
    path: string,
    expected_generation: number,
  ): Promise<FolderLoadResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    if (expected_generation !== this.vault_store.generation) {
      return { status: "stale" };
    }

    try {
      const contents = await this.notes_port.list_folder_contents(
        vault_id,
        path,
        0,
        PAGE_SIZE,
      );

      if (expected_generation !== this.vault_store.generation) {
        return { status: "stale" };
      }

      this.notes_store.merge_folder_contents(path, contents);
      return {
        status: "loaded",
        total_count: contents.total_count,
        has_more: contents.has_more,
      };
    } catch (error) {
      if (expected_generation !== this.vault_store.generation) {
        return { status: "stale" };
      }

      const message = error_message(error);
      logger.error(`Load folder failed (${path}): ${message}`);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async load_folder_page(
    path: string,
    offset: number,
    expected_generation: number,
  ): Promise<FolderLoadResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }

    if (expected_generation !== this.vault_store.generation) {
      return { status: "stale" };
    }

    try {
      const contents = await this.notes_port.list_folder_contents(
        vault_id,
        path,
        offset,
        PAGE_SIZE,
      );

      if (expected_generation !== this.vault_store.generation) {
        return { status: "stale" };
      }

      this.notes_store.append_folder_page(path, contents);
      return {
        status: "loaded",
        total_count: contents.total_count,
        has_more: contents.has_more,
      };
    } catch (error) {
      if (expected_generation !== this.vault_store.generation) {
        return { status: "stale" };
      }

      const message = error_message(error);
      logger.error(`Load folder page failed (${path}): ${message}`);
      return {
        status: "failed",
        error: message,
      };
    }
  }
}
