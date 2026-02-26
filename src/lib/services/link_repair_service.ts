import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchPort } from "$lib/ports/search_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { TabStore } from "$lib/stores/tab_store.svelte";
import {
  as_markdown_text,
  as_note_path,
  type NotePath,
  type VaultId,
} from "$lib/types/ids";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("link_repair_service");

export class LinkRepairService {
  constructor(
    private readonly notes_port: NotesPort,
    private readonly search_port: SearchPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly editor_store: EditorStore,
    private readonly tab_store: TabStore,
    private readonly now_ms: () => number,
    private readonly close_editor_buffer: (path: NotePath) => void = () => {},
  ) {}

  async repair_links(
    vault_id: VaultId,
    path_map: Map<string, string>,
  ): Promise<void> {
    if (path_map.size === 0) return;

    const target_map: Record<string, string> = Object.fromEntries(path_map);

    const external_sources = new Set<string>();
    for (const old_path of path_map.keys()) {
      try {
        const snapshot = await this.search_port.get_note_links_snapshot(
          vault_id,
          old_path,
        );
        for (const backlink of snapshot.backlinks) {
          if (!path_map.has(backlink.path)) {
            external_sources.add(backlink.path);
          }
        }
      } catch (error) {
        log.warn("Collect backlinks failed", {
          old_path,
          error: error_message(error),
        });
      }
    }

    for (const source_path of external_sources) {
      await this.rewrite_note_file(
        vault_id,
        as_note_path(source_path),
        source_path,
        source_path,
        target_map,
      );
    }

    for (const [old_path, new_path] of path_map) {
      await this.rewrite_note_file(
        vault_id,
        as_note_path(new_path),
        old_path,
        new_path,
        target_map,
      );
    }
  }

  private async rewrite_note_file(
    vault_id: VaultId,
    note_path: NotePath,
    old_source_path: string,
    new_source_path: string,
    target_map: Record<string, string>,
  ): Promise<void> {
    try {
      const open_note = this.editor_store.open_note;
      const matched_open_note =
        open_note?.meta.id === note_path ||
        (old_source_path !== new_source_path &&
          String(open_note?.meta.id) === old_source_path)
          ? open_note
          : null;

      const markdown = matched_open_note
        ? matched_open_note.markdown
        : (await this.notes_port.read_note(vault_id, note_path)).markdown;

      const result = await this.search_port.rewrite_note_links(
        markdown,
        old_source_path,
        new_source_path,
        target_map,
      );

      if (!result.changed) return;

      const rewritten = as_markdown_text(result.markdown);

      if (matched_open_note) {
        const repair_buffer_id = `${matched_open_note.buffer_id}:repair-links:${String(this.now_ms())}`;
        this.editor_store.set_open_note({
          ...matched_open_note,
          markdown: rewritten,
          buffer_id: repair_buffer_id,
          is_dirty: matched_open_note.is_dirty,
        });
        if (!matched_open_note.is_dirty) {
          await this.notes_port.write_note(vault_id, note_path, rewritten);
          await this.index_port.upsert_note(vault_id, note_path);
        }
        return;
      }

      await this.notes_port.write_note(vault_id, note_path, rewritten);
      await this.index_port.upsert_note(vault_id, note_path);
      this.tab_store.invalidate_cache_by_path(note_path);
      if (old_source_path !== new_source_path) {
        this.tab_store.invalidate_cache_by_path(
          as_note_path(old_source_path),
        );
        this.close_editor_buffer(as_note_path(old_source_path));
      }
      this.close_editor_buffer(note_path);
    } catch (error) {
      log.warn("Rewrite links failed", {
        note_path,
        old_source_path,
        new_source_path,
        error: error_message(error),
      });
    }
  }
}
