import type { SearchPort } from "$lib/ports/search_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { LinksStore } from "$lib/stores/links_store.svelte";
import { create_logger } from "$lib/utils/logger";
import { error_message } from "$lib/utils/error_message";

const log = create_logger("links_service");

export class LinksService {
  private active_revision = 0;

  constructor(
    private readonly search_port: SearchPort,
    private readonly vault_store: VaultStore,
    private readonly links_store: LinksStore,
  ) {}

  async load_note_links(note_path: string): Promise<void> {
    const revision = ++this.active_revision;
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      this.links_store.clear();
      return;
    }

    try {
      const snapshot = await this.search_port.get_note_links_snapshot(
        vault_id,
        note_path,
      );
      if (revision !== this.active_revision) return;
      this.links_store.set_snapshot(note_path, snapshot);
    } catch (error) {
      if (revision !== this.active_revision) return;
      log.error("Failed to load note links", { error: error_message(error) });
      this.links_store.set_snapshot(note_path, {
        backlinks: [],
        outlinks: [],
        orphan_links: [],
      });
    }
  }

  clear() {
    this.active_revision += 1;
    this.links_store.clear();
  }
}
