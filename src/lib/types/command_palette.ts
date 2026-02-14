export type CommandId =
  | "create_new_note"
  | "change_vault"
  | "open_settings"
  | "reindex_vault"
  | "show_vault_dashboard"
  | "git_version_history"
  | "git_create_checkpoint"
  | "git_init_repo";

export type CommandIcon =
  | "file-plus"
  | "folder-open"
  | "settings"
  | "git-branch"
  | "history"
  | "bookmark";

export type CommandDefinition = {
  id: CommandId;
  label: string;
  description: string;
  keywords: string[];
  icon: CommandIcon;
};
