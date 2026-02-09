import type { VaultPort } from "$lib/ports/vault_port";
import type { NotesPort } from "$lib/ports/notes_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { ThemePort } from "$lib/ports/theme_port";
import type { VaultId, VaultPath } from "$lib/types/ids";
import type { Vault } from "$lib/types/vault";
import type { VaultStore } from "$lib/stores/vault_store.svelte";
import type { NotesStore } from "$lib/stores/notes_store.svelte";
import type { EditorStore } from "$lib/stores/editor_store.svelte";
import type { OpStore } from "$lib/stores/op_store.svelte";
import type { SearchStore } from "$lib/stores/search_store.svelte";
import {
  DEFAULT_EDITOR_SETTINGS,
  SETTINGS_KEY,
  type EditorSettings,
} from "$lib/types/editor_settings";
import type {
  ThemeSetResult,
  VaultChoosePathResult,
  VaultInitializeResult,
  VaultOpenResult,
} from "$lib/types/vault_service_result";
import { ensure_open_note } from "$lib/utils/ensure_open_note";
import { error_message } from "$lib/utils/error_message";
import { logger } from "$lib/utils/logger";
import type { ThemeMode } from "$lib/types/theme";
import { PAGE_SIZE } from "$lib/constants/pagination";

export type AppMountConfig = {
  reset_app_state: boolean;
  bootstrap_default_vault_path: VaultPath | null;
};

export class VaultService {
  constructor(
    private readonly vault_port: VaultPort,
    private readonly notes_port: NotesPort,
    private readonly index_port: WorkspaceIndexPort,
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

  async initialize(config: AppMountConfig): Promise<VaultInitializeResult> {
    const theme = this.get_theme();

    if (config.reset_app_state) {
      this.reset_app_state();
    }

    this.op_store.start("app.startup");

    try {
      let editor_settings: EditorSettings | null = null;

      const has_vault = this.vault_store.vault !== null;

      if (!has_vault && config.bootstrap_default_vault_path) {
        editor_settings = await this.open_vault_by_path(
          config.bootstrap_default_vault_path,
        );
      } else {
        const recent_vaults = await this.vault_port.list_vaults();
        this.vault_store.set_recent_vaults(recent_vaults);

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
      logger.error(`App startup failed: ${message}`);
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
    this.op_store.start("vault.change");

    try {
      const editor_settings = await this.open_vault_by_path(vault_path);
      this.op_store.succeed("vault.change");
      return {
        status: "opened",
        editor_settings,
      };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Choose vault failed: ${message}`);
      this.op_store.fail("vault.change", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async change_vault_by_id(vault_id: VaultId): Promise<VaultOpenResult> {
    this.op_store.start("vault.change");

    try {
      const editor_settings = await this.open_vault_by_id(vault_id);
      this.op_store.succeed("vault.change");
      return {
        status: "opened",
        editor_settings,
      };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Select vault failed: ${message}`);
      this.op_store.fail("vault.change", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  set_theme(theme: ThemeMode): ThemeSetResult {
    this.op_store.start("theme.set");

    try {
      this.theme_port.set_theme(theme);
      this.op_store.succeed("theme.set");
      return { status: "success" };
    } catch (error) {
      const message = error_message(error);
      logger.error(`Set theme failed: ${message}`);
      this.op_store.fail("theme.set", message);
      return {
        status: "failed",
        error: message,
      };
    }
  }

  private async open_vault_by_path(
    vault_path: VaultPath,
  ): Promise<EditorSettings> {
    const vault = await this.vault_port.open_vault(vault_path);
    return this.finish_open_vault(vault);
  }

  private async open_vault_by_id(vault_id: VaultId): Promise<EditorSettings> {
    const vault = await this.vault_port.open_vault_by_id(vault_id);
    return this.finish_open_vault(vault);
  }

  private async finish_open_vault(vault: Vault): Promise<EditorSettings> {
    await this.vault_port.remember_last_vault(vault.id);

    const [root_contents, recent_vaults] = await Promise.all([
      this.notes_port.list_folder_contents(vault.id, "", 0, PAGE_SIZE),
      this.vault_port.list_vaults(),
    ]);

    this.index_progress_unsubscribe?.();
    this.index_progress_unsubscribe = this.index_port.subscribe_index_progress(
      (event) => {
        this.search_store.set_index_progress(event);
      },
    );

    this.index_port.build_index(vault.id).catch((e: unknown) => {
      logger.error(`Background index build failed: ${error_message(e)}`);
    });

    this.vault_store.clear();
    this.notes_store.reset();
    this.editor_store.reset();

    this.vault_store.set_vault(vault);
    this.notes_store.merge_folder_contents("", root_contents);
    this.vault_store.set_recent_vaults(recent_vaults);

    const ensured_note = ensure_open_note({
      vault,
      notes: root_contents.notes,
      open_note: null,
      now_ms: this.now_ms(),
    });

    if (ensured_note) {
      this.editor_store.set_open_note(ensured_note);
    }

    return this.load_editor_settings(vault.id);
  }

  private async load_editor_settings(
    vault_id: VaultId,
  ): Promise<EditorSettings> {
    const stored =
      await this.vault_settings_port.get_vault_setting<EditorSettings>(
        vault_id,
        SETTINGS_KEY,
      );
    if (stored) {
      return { ...DEFAULT_EDITOR_SETTINGS, ...stored };
    }

    const legacy =
      await this.settings_port.get_setting<EditorSettings>(SETTINGS_KEY);
    if (legacy) {
      const migrated = { ...DEFAULT_EDITOR_SETTINGS, ...legacy };
      await this.vault_settings_port.set_vault_setting(
        vault_id,
        SETTINGS_KEY,
        migrated,
      );
      return migrated;
    }

    return { ...DEFAULT_EDITOR_SETTINGS };
  }

  private reset_app_state() {
    this.vault_store.reset();
    this.notes_store.reset();
    this.editor_store.reset();
    this.op_store.reset_all();
  }
}
