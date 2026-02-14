import type { CommandDefinition } from "$lib/types/command_palette";

export const COMMANDS_REGISTRY: CommandDefinition[] = [
  {
    id: "create_new_note",
    label: "Create new note",
    description: "Create an untitled note in the current folder",
    keywords: ["new", "add", "create", "note", "file", "document"],
    icon: "file-plus",
  },
  {
    id: "change_vault",
    label: "Change vault",
    description: "Switch to a different vault",
    keywords: ["switch", "vault", "folder", "workspace", "change", "open"],
    icon: "folder-open",
  },
  {
    id: "open_settings",
    label: "Settings",
    description: "Open application settings",
    keywords: ["settings", "preferences", "config", "options", "configure"],
    icon: "settings",
  },
  {
    id: "reindex_vault",
    label: "Reindex vault",
    description: "Rebuild search index for the current vault",
    keywords: ["index", "rebuild", "search", "vault", "reindex", "repair"],
    icon: "settings",
  },
  {
    id: "show_vault_dashboard",
    label: "Show vault dashboard",
    description: "Open vault dashboard overview",
    keywords: ["dashboard", "vault", "overview", "stats", "activity"],
    icon: "folder-open",
  },
  {
    id: "git_version_history",
    label: "Version History",
    description: "View version history for the current note",
    keywords: ["history", "versions", "git", "log", "timeline"],
    icon: "history",
  },
  {
    id: "git_create_checkpoint",
    label: "Create Checkpoint",
    description: "Save a named checkpoint of the current state",
    keywords: ["checkpoint", "snapshot", "save", "git", "commit"],
    icon: "bookmark",
  },
  {
    id: "git_init_repo",
    label: "Initialize Git Repository",
    description: "Initialize version control for this vault",
    keywords: ["git", "init", "repo", "repository", "version", "control"],
    icon: "git-branch",
  },
];
