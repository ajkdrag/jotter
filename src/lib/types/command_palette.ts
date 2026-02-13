export type CommandId =
  | "create_new_note"
  | "change_vault"
  | "open_settings"
  | "reindex_vault"
  | "show_vault_dashboard";

export type CommandIcon = "file-plus" | "folder-open" | "settings";

export type CommandDefinition = {
  id: CommandId;
  label: string;
  description: string;
  keywords: string[];
  icon: CommandIcon;
};
