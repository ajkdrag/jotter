import { create_assets_tauri_adapter } from "$lib/adapters/tauri/assets_tauri_adapter";
import { create_notes_tauri_adapter } from "$lib/adapters/tauri/notes_tauri_adapter";
import { create_vault_tauri_adapter } from "$lib/adapters/tauri/vault_tauri_adapter";
import { create_workspace_index_tauri_adapter } from "$lib/adapters/tauri/workspace_index_tauri_adapter";
import { create_settings_tauri_adapter } from "$lib/adapters/tauri/settings_tauri_adapter";
import { create_vault_settings_tauri_adapter } from "$lib/adapters/tauri/vault_settings_tauri_adapter";
import { create_search_tauri_adapter } from "$lib/adapters/tauri/search_tauri_adapter";
import { create_milkdown_editor_port } from "$lib/adapters/editor/milkdown_adapter";
import { create_clipboard_tauri_adapter } from "$lib/adapters/tauri/clipboard_tauri_adapter";
import { create_watcher_tauri_adapter } from "$lib/adapters/tauri/watcher_tauri_adapter";
import { create_shell_tauri_adapter } from "$lib/adapters/tauri/shell_tauri_adapter";
import { create_git_tauri_adapter } from "$lib/adapters/tauri/git_tauri_adapter";
import type { Ports } from "$lib/ports/ports";

export function create_prod_ports(): Ports {
  const assets = create_assets_tauri_adapter();
  const vault = create_vault_tauri_adapter();
  const notes = create_notes_tauri_adapter();
  const index = create_workspace_index_tauri_adapter();
  const search = create_search_tauri_adapter();
  const settings = create_settings_tauri_adapter();
  const vault_settings = create_vault_settings_tauri_adapter();
  const clipboard = create_clipboard_tauri_adapter();
  const watcher = create_watcher_tauri_adapter();
  const shell = create_shell_tauri_adapter();
  const git = create_git_tauri_adapter();

  return {
    vault,
    notes,
    index,
    search,
    settings,
    vault_settings,
    assets,
    editor: create_milkdown_editor_port({
      resolve_asset_url_for_vault: (vault_id, asset_path) =>
        assets.resolve_asset_url(vault_id, asset_path),
    }),
    clipboard,
    watcher,
    shell,
    git,
  };
}
