import type { NotesPort } from "$lib/ports/notes_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { TabStore } from "$lib/stores/tab_store.svelte";
import type {
  FolderDeleteStatsResult,
  FolderLoadResult,
  FolderMoveResult,
  FolderMutationResult,
} from "$lib/types/folder_service_result";
import type { MoveItem } from "$lib/types/filetree";
import { PAGE_SIZE } from "$lib/constants/pagination";
import { error_message } from "$lib/utils/error_message";
import { ensure_open_note } from "$lib/domain/ensure_open_note";
import { create_logger } from "$lib/utils/logger";
import { move_destination_path } from "$lib/domain/filetree";
import { as_note_path } from "$lib/types/ids";

const log = create_logger("folder_service");

export class FolderService {
  constructor(
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly tab_store: TabStore,
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

    this.op_store.start("folder.create", this.now_ms());

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
      log.error("Create folder failed", { error: message });
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

    this.op_store.start("folder.delete_stats", this.now_ms());

    try {
      const stats = await this.notes_port.get_folder_stats(
        vault_id,
        folder_path,
      );
      this.op_store.succeed("folder.delete_stats");
      return {
        status: "ready",
        affected_note_count: stats.note_count,
        affected_folder_count: stats.folder_count,
      };
    } catch (error) {
      const message = error_message(error);
      log.error("Load folder delete stats failed", { error: message });
      this.op_store.fail("folder.delete_stats", message);
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

    this.op_store.start("folder.delete", this.now_ms());

    try {
      const folder_prefix = `${folder_path}/`;
      const contains_open_note =
        this.editor_store.open_note?.meta.path.startsWith(folder_prefix) ??
        false;

      await this.notes_port.delete_folder(vault_id, folder_path);
      await this.index_port.remove_notes_by_prefix(vault_id, folder_prefix);

      this.notes_store.remove_folder(folder_path);
      this.notes_store.remove_recent_notes_by_prefix(folder_prefix);

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
      log.error("Delete folder failed", { error: message });
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

    this.op_store.start("folder.rename", this.now_ms());

    try {
      await this.notes_port.rename_folder(vault_id, folder_path, new_path);
      this.op_store.succeed("folder.rename");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      log.error("Rename folder failed", { error: message });
      this.op_store.fail("folder.rename", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async move_items(
    items: MoveItem[],
    target_folder: string,
    overwrite: boolean,
  ): Promise<FolderMoveResult> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id || items.length === 0) {
      return { status: "skipped" };
    }

    this.op_store.start("folder.move", this.now_ms());

    try {
      const results = await this.notes_port.move_items(
        vault_id,
        items,
        target_folder,
        overwrite,
      );

      for (const result of results) {
        if (!result.success) {
          continue;
        }
        const item = items.find((candidate) => candidate.path === result.path);
        if (!item) {
          continue;
        }
        if (item.is_folder) {
          this.notes_store.rename_folder(result.path, result.new_path);
          this.editor_store.update_open_note_path_prefix(
            `${result.path}/`,
            `${result.new_path}/`,
          );
          this.notes_store.update_recent_note_path_prefix(
            `${result.path}/`,
            `${result.new_path}/`,
          );
          this.tab_store.update_tab_path_prefix(
            `${result.path}/`,
            `${result.new_path}/`,
          );
          await this.index_port.rename_folder_paths(
            vault_id,
            `${result.path}/`,
            `${result.new_path}/`,
          );
          continue;
        }

        const old_note_path = as_note_path(result.path);
        const new_note_path = as_note_path(result.new_path);
        this.notes_store.rename_note(old_note_path, new_note_path);
        if (this.editor_store.open_note?.meta.id === old_note_path) {
          this.editor_store.update_open_note_path(new_note_path);
        }
        const renamed_note = this.notes_store.notes.find(
          (note) => note.path === new_note_path,
        );
        if (renamed_note) {
          this.notes_store.rename_recent_note(old_note_path, renamed_note);
        }
        this.tab_store.update_tab_path(old_note_path, new_note_path);
        await this.index_port.rename_note_path(
          vault_id,
          old_note_path,
          new_note_path,
        );
      }

      this.op_store.succeed("folder.move");
      return { status: "success", results };
    } catch (error) {
      const message = error_message(error);
      log.error("Move items failed", { error: message, target_folder });
      this.op_store.fail("folder.move", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  apply_folder_rename(folder_path: string, new_path: string): void {
    this.notes_store.rename_folder(folder_path, new_path);
    this.editor_store.update_open_note_path_prefix(
      `${folder_path}/`,
      `${new_path}/`,
    );
    this.notes_store.update_recent_note_path_prefix(
      `${folder_path}/`,
      `${new_path}/`,
    );
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
      log.error("Load folder failed", { path, error: message });
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
      log.error("Load folder page failed", { path, error: message });
      return {
        status: "failed",
        error: message,
      };
    }
  }

  reset_create_operation() {
    this.op_store.reset("folder.create");
  }

  reset_delete_stats_operation() {
    this.op_store.reset("folder.delete_stats");
  }

  reset_delete_operation() {
    this.op_store.reset("folder.delete");
  }

  reset_rename_operation() {
    this.op_store.reset("folder.rename");
  }

  async remove_notes_by_prefix(folder_prefix: string): Promise<void> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) return;
    await this.index_port.remove_notes_by_prefix(vault_id, folder_prefix);
  }

  async rename_folder_index(
    old_prefix: string,
    new_prefix: string,
  ): Promise<void> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) return;
    await this.index_port.rename_folder_paths(vault_id, old_prefix, new_prefix);
  }

  build_move_preview(items: MoveItem[], target_folder: string) {
    return items.map((item) => ({
      ...item,
      new_path: move_destination_path(item.path, target_folder),
    }));
  }
}
