import { create_assets_tauri_adapter } from "$lib/adapters/tauri/assets_tauri_adapter";
import { create_notes_tauri_adapter } from "$lib/adapters/tauri/notes_tauri_adapter";
import { create_vault_tauri_adapter } from "$lib/adapters/tauri/vault_tauri_adapter";
import { create_workspace_index_tauri_adapter } from "$lib/adapters/tauri/workspace_index_tauri_adapter";
import { create_settings_tauri_adapter } from "$lib/adapters/tauri/settings_tauri_adapter";
import { create_vault_settings_tauri_adapter } from "$lib/adapters/tauri/vault_settings_tauri_adapter";
import { create_search_tauri_adapter } from "$lib/adapters/tauri/search_tauri_adapter";
import { create_theme_adapter } from "$lib/adapters/theme_adapter";
import { create_milkdown_editor_port } from "$lib/adapters/editor/milkdown_adapter";
import { create_clipboard_tauri_adapter } from "$lib/adapters/tauri/clipboard_tauri_adapter";
import { create_watcher_tauri_adapter } from "$lib/adapters/tauri/watcher_tauri_adapter";
import { create_shell_tauri_adapter } from "$lib/adapters/tauri/shell_tauri_adapter";
import { create_git_tauri_adapter } from "$lib/adapters/tauri/git_tauri_adapter";
import type { Ports } from "$lib/ports/ports";

export function create_prod_ports(): Ports {
  const assets = create_assets_tauri_adapter();

  return {
    vault: create_vault_tauri_adapter(),
    notes: create_notes_tauri_adapter(),
    index: create_workspace_index_tauri_adapter(),
    search: create_search_tauri_adapter(),
    settings: create_settings_tauri_adapter(),
    vault_settings: create_vault_settings_tauri_adapter(),
    assets,
    editor: create_milkdown_editor_port({
      resolve_asset_url_for_vault: (vault_id, asset_path) =>
        assets.resolve_asset_url(vault_id, asset_path),
    }),
    theme: create_theme_adapter(),
    clipboard: create_clipboard_tauri_adapter(),
    watcher: create_watcher_tauri_adapter(),
    shell: create_shell_tauri_adapter(),
    git: create_git_tauri_adapter(),
  };
}
