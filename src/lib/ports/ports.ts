import type { AssetsPort } from "$lib/ports/assets_port";
import type { ClipboardPort } from "$lib/ports/clipboard_port";
import type { EditorPort } from "$lib/ports/editor_port";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchPort } from "$lib/ports/search_port";
import type { SettingsPort } from "$lib/ports/settings_port";
import type { VaultPort } from "$lib/ports/vault_port";
import type { VaultSettingsPort } from "$lib/ports/vault_settings_port";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { GitPort } from "$lib/ports/git_port";
import type { ShellPort } from "$lib/ports/shell_port";
import type { WatcherPort } from "$lib/ports/watcher_port";

export type Ports = {
  vault: VaultPort;
  notes: NotesPort;
  index: WorkspaceIndexPort;
  search: SearchPort;
  settings: SettingsPort;
  vault_settings: VaultSettingsPort;
  assets: AssetsPort;
  editor: EditorPort;
  clipboard: ClipboardPort;
  watcher: WatcherPort;
  shell: ShellPort;
  git: GitPort;
};
