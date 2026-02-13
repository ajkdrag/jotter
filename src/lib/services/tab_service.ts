import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { TabStore } from "$lib/stores/tab_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { NoteService } from "$lib/services/note_service";
import type { Tab, PersistedTabState } from "$lib/types/tab";
import { note_name_from_path } from "$lib/utils/path";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("tab_service");
const TABS_KEY = "open_tabs";

export class TabService {
  constructor(
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly vault_store: VaultStore,
    private readonly tab_store: TabStore,
    private readonly notes_store: NotesStore,
    private readonly note_service: NoteService,
  ) {}

  async save_tabs(): Promise<void> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) return;

    const known_paths = new Set(this.notes_store.notes.map((n) => n.path));
    const persistable_tabs = this.tab_store.tabs.filter((t) =>
      known_paths.has(t.note_path),
    );
    const active_path = this.tab_store.active_tab?.note_path ?? null;

    const state: PersistedTabState = {
      tabs: persistable_tabs.map((t) => {
        const snapshot = this.tab_store.get_snapshot(t.id);
        return {
          note_path: t.note_path,
          is_pinned: t.is_pinned,
          cursor: snapshot?.cursor ?? null,
        };
      }),
      active_tab_path:
        active_path && known_paths.has(active_path) ? active_path : null,
    };

    try {
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        TABS_KEY,
        state,
      );
    } catch (error) {
      log.error("Save tabs failed", { error });
    }
  }

  sync_dirty_state(tab_id: string, is_dirty: boolean) {
    this.tab_store.set_dirty(tab_id, is_dirty);
  }

  async load_tabs(): Promise<PersistedTabState | null> {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) return null;

    try {
      const stored =
        await this.vault_settings_port.get_vault_setting<PersistedTabState>(
          vault_id,
          TABS_KEY,
        );
      if (!stored || !Array.isArray(stored.tabs)) {
        return null;
      }
      return stored;
    } catch (error) {
      log.error("Load tabs failed", { error });
      return null;
    }
  }

  async restore_tabs(persisted: PersistedTabState): Promise<void> {
    const tabs: Tab[] = persisted.tabs
      .filter(
        (t) => typeof t.note_path === "string" && t.note_path.endsWith(".md"),
      )
      .map((t) => ({
        id: t.note_path,
        note_path: t.note_path,
        title: note_name_from_path(t.note_path),
        is_pinned: Boolean(t.is_pinned),
        is_dirty: false,
      }));

    if (tabs.length === 0) return;

    const active_path = persisted.active_tab_path;
    const first_tab = tabs[0];
    const active_id =
      active_path && tabs.some((t) => t.id === active_path)
        ? active_path
        : first_tab
          ? first_tab.id
          : null;

    this.tab_store.restore_tabs(tabs, active_id);

    for (const pt of persisted.tabs) {
      if (pt.cursor) {
        const tab = tabs.find((t) => t.note_path === pt.note_path);
        if (tab) {
          this.tab_store.set_snapshot(tab.id, {
            scroll_top: 0,
            cursor: pt.cursor,
          });
        }
      }
    }

    if (active_id) {
      const active_tab = tabs.find((t) => t.id === active_id);
      if (active_tab) {
        const result = await this.note_service.open_note(
          active_tab.note_path,
          false,
        );
        if (result.status === "not_found") {
          this.tab_store.remove_tab_by_path(active_tab.note_path);
        }
      }
    }
  }
}
