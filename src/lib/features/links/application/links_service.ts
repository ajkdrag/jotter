import type { SearchPort } from "$lib/features/search";
import type { VaultStore } from "$lib/features/vault";
import type { LinksStore } from "$lib/features/links/state/links_store.svelte";
import type { VaultId } from "$lib/shared/types/ids";
import { create_logger } from "$lib/shared/utils/logger";
import { error_message } from "$lib/shared/utils/error_message";

const log = create_logger("links_service");

export class LinksService {
  private active_revision = 0;
  private active_local_revision = 0;
  private last_local_note_path: string | null = null;
  private last_local_markdown: string | null = null;

  constructor(
    private readonly search_port: SearchPort,
    private readonly vault_store: VaultStore,
    private readonly links_store: LinksStore,
  ) {}

  private get_active_vault_id(): VaultId | null {
    return this.vault_store.vault?.id ?? null;
  }

  private is_global_request_stale(revision: number): boolean {
    return revision !== this.active_revision;
  }

  private is_local_request_stale(revision: number): boolean {
    return revision !== this.active_local_revision;
  }

  private is_same_local_request(note_path: string, markdown: string): boolean {
    return (
      note_path === this.last_local_note_path &&
      markdown === this.last_local_markdown
    );
  }

  private set_empty_local_snapshot(note_path: string): void {
    this.links_store.set_local_snapshot(note_path, {
      outlink_paths: [],
      external_links: [],
    });
  }

  async load_note_links(note_path: string): Promise<void> {
    const revision = ++this.active_revision;
    const vault_id = this.get_active_vault_id();
    if (!vault_id) {
      this.links_store.clear();
      return;
    }

    this.links_store.start_global_load(note_path);

    try {
      const snapshot = await this.search_port.get_note_links_snapshot(
        vault_id,
        note_path,
      );
      if (this.is_global_request_stale(revision)) return;
      this.links_store.set_global_snapshot(note_path, snapshot);
    } catch (error) {
      if (this.is_global_request_stale(revision)) return;
      const message = error_message(error);
      log.error("Failed to load note links", { error: message });
      this.links_store.set_global_error(note_path, message);
    }
  }

  async update_local_note_links(
    note_path: string,
    markdown: string,
  ): Promise<void> {
    if (this.is_same_local_request(note_path, markdown)) {
      return;
    }

    const vault_id = this.get_active_vault_id();
    if (!vault_id) {
      this.set_empty_local_snapshot(note_path);
      return;
    }

    this.last_local_note_path = note_path;
    this.last_local_markdown = markdown;
    const revision = ++this.active_local_revision;

    try {
      const snapshot = await this.search_port.extract_local_note_links(
        vault_id,
        note_path,
        markdown,
      );
      if (this.is_local_request_stale(revision)) return;
      if (!this.is_same_local_request(note_path, markdown)) {
        return;
      }
      this.links_store.set_local_snapshot(note_path, snapshot);
    } catch (error) {
      if (this.is_local_request_stale(revision)) return;
      const message = error_message(error);
      log.error("Failed to extract local note links", { error: message });
      this.set_empty_local_snapshot(note_path);
    }
  }

  clear() {
    this.active_revision += 1;
    this.active_local_revision += 1;
    this.last_local_note_path = null;
    this.last_local_markdown = null;
    this.links_store.clear();
  }
}
