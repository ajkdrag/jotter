import type { VaultPort } from "$lib/ports/vault_port";
import type { NotesPort } from "$lib/ports/notes_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { WatcherPort } from "$lib/ports/watcher_port";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { ThemePort } from "$lib/ports/theme_port";
import {
  as_note_path,
  as_vault_id,
  type VaultId,
  type VaultPath,
} from "$lib/types/ids";
import type { Vault } from "$lib/types/vault";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { SearchStore } from "$lib/stores/search_store.svelte";
import type { NoteMeta } from "$lib/types/note";
import {
  DEFAULT_EDITOR_SETTINGS,
  SETTINGS_KEY,
  omit_global_only_keys,
  apply_global_only_overrides,
  type EditorSettings,
} from "$lib/types/editor_settings";
import type {
  ThemeSetResult,
  VaultChoosePathResult,
  VaultInitializeResult,
  VaultOpenResult,
} from "$lib/types/vault_service_result";
import { ensure_open_note } from "$lib/domain/ensure_open_note";
import { error_message } from "$lib/utils/error_message";
import { create_logger } from "$lib/utils/logger";
import type { ThemeMode } from "$lib/types/theme";
import { PAGE_SIZE } from "$lib/constants/pagination";
import type { IndexChange } from "$lib/ports/workspace_index_port";
import type { VaultFsEvent } from "$lib/types/watcher";

const log = create_logger("vault_service");

export type AppMountConfig = {
  reset_app_state: boolean;
  bootstrap_default_vault_path: VaultPath | null;
};

const RECENT_NOTES_KEY = "recent_notes";
const STARRED_PATHS_KEY = "starred_paths";
const PINNED_VAULT_IDS_KEY = "pinned_vault_ids";
const WATCHER_INDEX_FLUSH_DELAY_MS = 120;
const WATCHER_BULK_FORCE_SCAN_THRESHOLD = 256;
class StaleVaultOpenError extends Error {
  constructor() {
    super("Stale vault-open request");
    this.name = "StaleVaultOpenError";
  }
}

export class VaultService {
  constructor(
    private readonly vault_port: VaultPort,
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
    private readonly watcher_port: WatcherPort,
    private readonly settings_port: SettingsPort,
    private readonly vault_settings_port: VaultSettingsPort,
    private readonly theme_port: ThemePort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly op_store: OpStore,
    private readonly search_store: SearchStore,
    private readonly now_ms: () => number,
  ) {}

  private index_progress_unsubscribe: (() => void) | null = null;
  private watcher_event_unsubscribe: (() => void) | null = null;
  private active_open_revision = 0;
  private watcher_index_flush_timer: ReturnType<typeof setTimeout> | null =
    null;
  private watcher_index_buffer_vault_id: VaultId | null = null;
  private watcher_index_buffer_revision = 0;
  private watcher_force_scan_buffered = false;
  private watcher_upsert_paths_buffer = new Set<string>();
  private watcher_remove_paths_buffer = new Set<string>();

  async initialize(config: AppMountConfig): Promise<VaultInitializeResult> {
    const theme = this.get_theme();

    if (config.reset_app_state) {
      this.reset_app_state();
    }

    this.op_store.start("app.startup", this.now_ms());

    try {
      let editor_settings: EditorSettings | null = null;

      const has_vault = this.vault_store.vault !== null;

      if (!has_vault && config.bootstrap_default_vault_path) {
        const default_path = config.bootstrap_default_vault_path;
        const open_revision = await this.begin_open_revision();
        editor_settings = await this.open_vault(
          () => this.vault_port.open_vault(default_path),
          open_revision,
        );
      } else {
        const [recent_vaults, pinned_vault_ids] = await Promise.all([
          this.vault_port.list_vaults(),
          this.load_pinned_vault_ids(),
        ]);
        this.vault_store.set_recent_vaults(recent_vaults);
        this.vault_store.set_pinned_vault_ids(pinned_vault_ids);

        const current_vault_id = this.vault_store.vault?.id;
        if (current_vault_id) {
          editor_settings = await this.load_editor_settings(current_vault_id);
        }
      }

      this.op_store.succeed("app.startup");

      return {
        status: "ready",
        theme,
        has_vault: this.vault_store.vault !== null,
        editor_settings,
      };
    } catch (error) {
      const message = error_message(error);
      log.error("App startup failed", { error: message });
      this.op_store.fail("app.startup", message);
      return {
        status: "error",
        theme,
        error: message,
      };
    }
  }

  get_theme(): ThemeMode {
    return this.theme_port.get_theme();
  }

  async choose_vault_path(): Promise<VaultChoosePathResult> {
    try {
      const vault_path = await this.vault_port.choose_vault();
      if (!vault_path) {
        return { status: "cancelled" };
      }

      return {
        status: "selected",
        path: vault_path,
      };
    } catch (error) {
      return {
        status: "failed",
        error: error_message(error),
      };
    }
  }

  async change_vault_by_path(vault_path: VaultPath): Promise<VaultOpenResult> {
    return this.change_vault(
      (revision) =>
        this.open_vault(() => this.vault_port.open_vault(vault_path), revision),
      "Choose vault failed",
    );
  }

  async change_vault_by_id(vault_id: VaultId): Promise<VaultOpenResult> {
    return this.change_vault(
      (revision) =>
        this.open_vault(
          () => this.vault_port.open_vault_by_id(vault_id),
          revision,
        ),
      "Select vault failed",
    );
  }

  set_theme(theme: ThemeMode): ThemeSetResult {
    this.op_store.start("theme.set", this.now_ms());

    try {
      this.theme_port.set_theme(theme);
      this.op_store.succeed("theme.set");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      log.error("Set theme failed", { error: message });
      this.op_store.fail("theme.set", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async toggle_vault_pin(
    vault_id: VaultId,
  ): Promise<{ status: "success" } | { status: "failed"; error: string }> {
    const exists = this.vault_store.recent_vaults.some(
      (vault) => vault.id === vault_id,
    );
    if (!exists) {
      return { status: "failed", error: "Vault not found in recent list" };
    }

    const previous_pinned_ids = [...this.vault_store.pinned_vault_ids];
    this.op_store.start("vault.pin", this.now_ms());
    this.vault_store.toggle_pinned_vault(vault_id);

    try {
      await this.save_pinned_vault_ids(this.vault_store.pinned_vault_ids);
      this.op_store.succeed("vault.pin");
      return { status: "success" };
    } catch (error) {
      this.vault_store.set_pinned_vault_ids(previous_pinned_ids);
      const message = error_message(error);
      log.error("Toggle vault pin failed", { error: message });
      this.op_store.fail("vault.pin", message);
      return { status: "failed", error: message };
    }
  }

  async select_pinned_vault_by_slot(
    slot: number,
  ): Promise<VaultOpenResult | { status: "skipped" }> {
    const vault_id = this.vault_store.get_pinned_vault_id_by_slot(slot);
    if (!vault_id) {
      return { status: "skipped" };
    }
    return this.change_vault_by_id(vault_id);
  }

  async remove_vault_from_registry(
    vault_id: VaultId,
  ): Promise<{ status: "success" } | { status: "failed"; error: string }> {
    if (this.vault_store.vault?.id === vault_id) {
      return { status: "failed", error: "Cannot remove active vault" };
    }

    const previous_recent_vaults = [...this.vault_store.recent_vaults];
    const previous_pinned_vault_ids = [...this.vault_store.pinned_vault_ids];
    this.op_store.start("vault.remove", this.now_ms());

    try {
      await this.vault_port.remove_vault(vault_id);
      const [recent_vaults, pinned_vault_ids] = await Promise.all([
        this.vault_port.list_vaults(),
        this.load_pinned_vault_ids(),
      ]);
      this.vault_store.set_recent_vaults(recent_vaults);
      this.vault_store.set_pinned_vault_ids(pinned_vault_ids);
      await this.save_pinned_vault_ids(this.vault_store.pinned_vault_ids);
      this.op_store.succeed("vault.remove");
      return { status: "success" };
    } catch (error) {
      this.vault_store.set_recent_vaults(previous_recent_vaults);
      this.vault_store.set_pinned_vault_ids(previous_pinned_vault_ids);
      const message = error_message(error);
      log.error("Remove vault from registry failed", { error: message });
      this.op_store.fail("vault.remove", message);
      return { status: "failed", error: message };
    }
  }

  async rebuild_index(): Promise<
    | { status: "started" }
    | { status: "skipped" }
    | { status: "failed"; error: string }
  > {
    const vault_id = this.vault_store.vault?.id;
    if (!vault_id) {
      return { status: "skipped" };
    }
    if (this.search_store.index_progress.status === "indexing") {
      return { status: "skipped" };
    }

    this.op_store.start("vault.reindex", this.now_ms());

    try {
      await this.index_port.rebuild_index(vault_id);
      this.op_store.succeed("vault.reindex");
      return { status: "started" };
    } catch (error) {
      const message = error_message(error);
      log.error("Reindex vault failed", { error: message });
      this.op_store.fail("vault.reindex", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  private async change_vault(
    open_fn: (revision: number) => Promise<EditorSettings>,
    error_label: string,
  ): Promise<VaultOpenResult> {
    const open_revision = await this.begin_open_revision();
    this.op_store.start("vault.change", this.now_ms());

    try {
      const editor_settings = await open_fn(open_revision);
      if (!this.is_current_open_revision(open_revision)) {
        return { status: "stale" };
      }
      this.op_store.succeed("vault.change");
      return {
        status: "opened",
        editor_settings,
        opened_from_vault_switch: true,
      };
    } catch (error) {
      if (error instanceof StaleVaultOpenError) {
        return { status: "stale" };
      }
      const message = error_message(error);
      log.error(error_label, { error: message });
      this.op_store.fail("vault.change", message);
      return { status: "failed", error: message };
    }
  }

  private async open_vault(
    open_fn: () => Promise<Vault>,
    open_revision: number,
  ): Promise<EditorSettings> {
    const vault = await open_fn();
    this.throw_if_stale(open_revision);
    return this.finish_open_vault(vault, open_revision);
  }

  private async finish_open_vault(
    vault: Vault,
    open_revision: number,
  ): Promise<EditorSettings> {
    this.throw_if_stale(open_revision);
    try {
      await this.watcher_port.unwatch_vault();
    } catch (error) {
      log.error("Unwatch vault failed", { error });
    }
    this.throw_if_stale(open_revision);
    await this.vault_port.remember_last_vault(vault.id);
    this.throw_if_stale(open_revision);

    const [root_contents, recent_vaults, pinned_vault_ids] = await Promise.all([
      this.notes_port.list_folder_contents(vault.id, "", 0, PAGE_SIZE),
      this.vault_port.list_vaults(),
      this.load_pinned_vault_ids(),
    ]);
    this.throw_if_stale(open_revision);

    const loaded_recent_notes = await this.load_recent_notes(vault.id);
    const loaded_starred_paths = await this.load_starred_paths(vault.id);
    const editor_settings = await this.load_editor_settings(vault.id);
    this.throw_if_stale(open_revision);

    this.index_progress_unsubscribe?.();
    this.index_progress_unsubscribe = null;
    this.watcher_event_unsubscribe?.();
    this.watcher_event_unsubscribe = null;
    this.vault_store.clear();
    this.notes_store.reset();
    this.editor_store.reset();
    this.search_store.reset();

    this.vault_store.set_vault(vault);
    this.notes_store.merge_folder_contents("", root_contents);
    this.vault_store.set_recent_vaults(recent_vaults);
    this.vault_store.set_pinned_vault_ids(pinned_vault_ids);
    this.notes_store.set_recent_notes(loaded_recent_notes);
    this.notes_store.set_starred_paths(loaded_starred_paths);

    const ensured_note = ensure_open_note({
      vault,
      notes: root_contents.notes,
      open_note: null,
      now_ms: this.now_ms(),
    });

    if (ensured_note) {
      this.editor_store.set_open_note(ensured_note);
    }

    const target_vault_id = vault.id;
    const event_revision = open_revision;
    this.index_progress_unsubscribe = this.index_port.subscribe_index_progress(
      (event) => {
        if (!this.is_current_open_revision(event_revision)) {
          return;
        }
        if (event.vault_id === target_vault_id) {
          this.search_store.set_index_progress(event);
        }
      },
    );

    try {
      await this.watcher_port.watch_vault(vault.id);
      this.throw_if_stale(open_revision);
      this.watcher_event_unsubscribe = this.watcher_port.subscribe_fs_events(
        (event) => {
          if (!this.is_current_open_revision(event_revision)) {
            return;
          }
          if (event.vault_id !== target_vault_id) {
            return;
          }
          this.handle_watcher_event(target_vault_id, event, event_revision);
        },
      );
    } catch (error) {
      log.error("Watch vault failed", { error });
    }

    this.index_port.sync_index(vault.id).catch((e: unknown) => {
      if (!this.is_current_open_revision(event_revision)) {
        return;
      }
      log.error("Background index sync failed", { error: e });
    });

    return editor_settings;
  }

  private async load_editor_settings(
    vault_id: VaultId,
  ): Promise<EditorSettings> {
    const get_global = (k: string) =>
      this.settings_port.get_setting<unknown>(k);

    const stored =
      await this.vault_settings_port.get_vault_setting<EditorSettings>(
        vault_id,
        SETTINGS_KEY,
      );
    if (stored) {
      const vault_only = omit_global_only_keys(
        stored as Record<string, unknown>,
      ) as Partial<EditorSettings>;
      const merged = { ...DEFAULT_EDITOR_SETTINGS, ...vault_only };
      return apply_global_only_overrides(merged, get_global);
    }

    const legacy =
      await this.settings_port.get_setting<EditorSettings>(SETTINGS_KEY);
    if (legacy) {
      const vault_only = omit_global_only_keys(
        legacy as Record<string, unknown>,
      ) as Partial<EditorSettings>;
      const migrated = { ...DEFAULT_EDITOR_SETTINGS, ...vault_only };
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        SETTINGS_KEY,
        vault_only,
      );
      return apply_global_only_overrides(migrated, get_global);
    }

    return apply_global_only_overrides(
      { ...DEFAULT_EDITOR_SETTINGS },
      get_global,
    );
  }

  async save_recent_notes(
    vault_id: VaultId,
    recent_notes: NoteMeta[],
  ): Promise<void> {
    try {
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        RECENT_NOTES_KEY,
        recent_notes,
      );
    } catch (error) {
      log.error("Save recent notes failed", { error });
    }
  }

  private async load_recent_notes(vault_id: VaultId): Promise<NoteMeta[]> {
    try {
      const stored = await this.vault_settings_port.get_vault_setting<unknown>(
        vault_id,
        RECENT_NOTES_KEY,
      );
      if (!stored || !Array.isArray(stored)) {
        return [];
      }
      const parsed = stored.filter((entry): entry is NoteMeta => {
        if (!entry || typeof entry !== "object") return false;
        const record = entry as Record<string, unknown>;
        return (
          typeof record.id === "string" &&
          typeof record.path === "string" &&
          typeof record.name === "string" &&
          typeof record.title === "string" &&
          typeof record.mtime_ms === "number" &&
          typeof record.size_bytes === "number"
        );
      });
      return parsed;
    } catch (error) {
      log.error("Load recent notes failed", { error });
      return [];
    }
  }

  async save_starred_paths(
    vault_id: VaultId,
    starred_paths: string[],
  ): Promise<void> {
    try {
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        STARRED_PATHS_KEY,
        starred_paths,
      );
    } catch (error) {
      log.error("Save starred paths failed", { error });
    }
  }

  private async load_starred_paths(vault_id: VaultId): Promise<string[]> {
    try {
      const stored = await this.vault_settings_port.get_vault_setting<unknown>(
        vault_id,
        STARRED_PATHS_KEY,
      );
      if (!stored || !Array.isArray(stored)) {
        return [];
      }
      return stored.filter(
        (entry): entry is string => typeof entry === "string",
      );
    } catch (error) {
      log.error("Load starred paths failed", { error });
      return [];
    }
  }

  private async save_pinned_vault_ids(vault_ids: VaultId[]): Promise<void> {
    await this.settings_port.set_setting(PINNED_VAULT_IDS_KEY, vault_ids);
  }

  private async load_pinned_vault_ids(): Promise<VaultId[]> {
    try {
      const stored =
        await this.settings_port.get_setting<unknown>(PINNED_VAULT_IDS_KEY);
      if (!stored || !Array.isArray(stored)) {
        return [];
      }
      return stored
        .filter((entry): entry is string => typeof entry === "string")
        .map((vault_id) => as_vault_id(vault_id));
    } catch (error) {
      log.error("Load pinned vault IDs failed", { error });
      return [];
    }
  }

  private reset_app_state() {
    this.vault_store.reset();
    this.notes_store.reset();
    this.editor_store.reset();
    this.op_store.reset_all();
  }

  reset_change_operation() {
    this.op_store.reset("vault.change");
  }

  private async begin_open_revision(): Promise<number> {
    const current_vault_id = this.vault_store.vault?.id;
    this.active_open_revision += 1;
    const revision = this.active_open_revision;
    this.index_progress_unsubscribe?.();
    this.index_progress_unsubscribe = null;
    this.watcher_event_unsubscribe?.();
    this.watcher_event_unsubscribe = null;
    this.reset_watcher_index_buffer();
    if (current_vault_id) {
      try {
        await this.index_port.cancel_index(current_vault_id);
      } catch (error) {
        log.error("Cancel index failed", { error });
      }
    }
    try {
      await this.watcher_port.unwatch_vault();
    } catch (error) {
      log.error("Unwatch vault failed", { error });
    }
    return revision;
  }

  private handle_watcher_event(
    vault_id: VaultId,
    event: VaultFsEvent,
    revision: number,
  ): void {
    if (!this.is_current_open_revision(revision)) {
      return;
    }

    let change: IndexChange | null = null;
    if (
      event.type === "note_changed_externally" ||
      event.type === "note_added"
    ) {
      if (event.note_path) {
        change = { kind: "upsert_path", path: as_note_path(event.note_path) };
      }
    } else if (event.type === "note_removed") {
      if (event.note_path) {
        change = { kind: "remove_path", path: as_note_path(event.note_path) };
      }
    } else {
      change = { kind: "force_scan" };
    }

    if (!change) {
      return;
    }

    this.buffer_watcher_index_change(vault_id, revision, change);
  }

  private reset_watcher_index_buffer(): void {
    if (this.watcher_index_flush_timer) {
      clearTimeout(this.watcher_index_flush_timer);
      this.watcher_index_flush_timer = null;
    }
    this.watcher_index_buffer_vault_id = null;
    this.watcher_index_buffer_revision = 0;
    this.watcher_force_scan_buffered = false;
    this.watcher_upsert_paths_buffer.clear();
    this.watcher_remove_paths_buffer.clear();
  }

  private schedule_watcher_index_flush(
    vault_id: VaultId,
    revision: number,
  ): void {
    if (this.watcher_index_flush_timer) {
      return;
    }
    this.watcher_index_flush_timer = setTimeout(() => {
      this.watcher_index_flush_timer = null;
      void this.flush_watcher_index_buffer(vault_id, revision);
    }, WATCHER_INDEX_FLUSH_DELAY_MS);
  }

  private buffer_watcher_index_change(
    vault_id: VaultId,
    revision: number,
    change: IndexChange,
  ): void {
    if (
      this.watcher_index_buffer_vault_id !== null &&
      (this.watcher_index_buffer_vault_id !== vault_id ||
        this.watcher_index_buffer_revision !== revision)
    ) {
      this.reset_watcher_index_buffer();
    }

    this.watcher_index_buffer_vault_id = vault_id;
    this.watcher_index_buffer_revision = revision;

    if (change.kind === "force_scan") {
      this.watcher_force_scan_buffered = true;
      this.watcher_upsert_paths_buffer.clear();
      this.watcher_remove_paths_buffer.clear();
      this.schedule_watcher_index_flush(vault_id, revision);
      return;
    }

    if (this.watcher_force_scan_buffered) {
      this.schedule_watcher_index_flush(vault_id, revision);
      return;
    }

    if (change.kind === "remove_path") {
      const path = String(change.path);
      this.watcher_upsert_paths_buffer.delete(path);
      this.watcher_remove_paths_buffer.add(path);
    } else if (change.kind === "upsert_path") {
      const path = String(change.path);
      this.watcher_remove_paths_buffer.delete(path);
      this.watcher_upsert_paths_buffer.add(path);
    }

    if (
      this.watcher_upsert_paths_buffer.size +
        this.watcher_remove_paths_buffer.size >=
      WATCHER_BULK_FORCE_SCAN_THRESHOLD
    ) {
      this.watcher_force_scan_buffered = true;
      this.watcher_upsert_paths_buffer.clear();
      this.watcher_remove_paths_buffer.clear();
    }

    this.schedule_watcher_index_flush(vault_id, revision);
  }

  private async flush_watcher_index_buffer(
    vault_id: VaultId,
    revision: number,
  ): Promise<void> {
    if (
      this.watcher_index_buffer_vault_id !== vault_id ||
      this.watcher_index_buffer_revision !== revision
    ) {
      return;
    }

    const force_scan = this.watcher_force_scan_buffered;
    const remove_paths = [...this.watcher_remove_paths_buffer];
    const upsert_paths = [...this.watcher_upsert_paths_buffer];

    this.watcher_force_scan_buffered = false;
    this.watcher_upsert_paths_buffer.clear();
    this.watcher_remove_paths_buffer.clear();

    if (!this.is_current_open_revision(revision)) {
      return;
    }

    try {
      if (force_scan) {
        await this.index_port.touch_index(vault_id, { kind: "force_scan" });
        return;
      }
      if (remove_paths.length === 0 && upsert_paths.length === 0) {
        return;
      }
      const tasks: Promise<void>[] = [];
      for (const path of remove_paths) {
        tasks.push(
          this.index_port.touch_index(vault_id, {
            kind: "remove_path",
            path: as_note_path(path),
          }),
        );
      }
      for (const path of upsert_paths) {
        tasks.push(
          this.index_port.touch_index(vault_id, {
            kind: "upsert_path",
            path: as_note_path(path),
          }),
        );
      }
      await Promise.all(tasks);
    } catch (error) {
      if (!this.is_current_open_revision(revision)) {
        return;
      }
      log.error("Watcher-triggered index sync failed", { error });
    }
  }

  private is_current_open_revision(revision: number): boolean {
    return revision === this.active_open_revision;
  }

  private throw_if_stale(revision: number): void {
    if (!this.is_current_open_revision(revision)) {
      throw new StaleVaultOpenError();
    }
  }
}
