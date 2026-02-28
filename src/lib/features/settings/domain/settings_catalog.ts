import type { EditorSettings } from "$lib/shared/types/editor_settings";

export type SettingDefinition = {
  key: keyof EditorSettings;
  label: string;
  description: string;
  category: string;
  keywords: string[];
};

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: "attachment_folder",
    label: "Attachment Folder",
    description: "Folder name for storing pasted images and attachments",
    category: "Files",
    keywords: [
      "assets",
      "images",
      "attachments",
      "folder",
      "path",
      "upload",
      "paste",
    ],
  },
  {
    key: "show_hidden_files",
    label: "Show Hidden Files",
    description: "Show dot-prefixed files and folders in the file tree",
    category: "Files",
    keywords: [
      "hidden",
      "dot",
      "dotfiles",
      "dotfolders",
      "invisible",
      "show",
      "hide",
    ],
  },
  {
    key: "autosave_enabled",
    label: "Autosave",
    description: "Automatically save markdown notes after edits",
    category: "Files",
    keywords: [
      "autosave",
      "auto save",
      "save",
      "automatic",
      "draft",
      "unsaved",
    ],
  },
  {
    key: "git_autocommit_enabled",
    label: "Git Auto-commit",
    description: "Automatically commit saved changes to Git",
    category: "Git",
    keywords: [
      "git",
      "autocommit",
      "auto commit",
      "commit",
      "version",
      "automatic",
    ],
  },
  {
    key: "show_vault_dashboard_on_open",
    label: "Show Vault Dashboard on Open",
    description: "Open vault dashboard automatically when switching vaults",
    category: "Misc",
    keywords: ["vault", "dashboard", "overview", "open", "startup", "switch"],
  },
  {
    key: "max_open_tabs",
    label: "Max Open Tabs",
    description: "Maximum number of tabs that can be open at once",
    category: "Layout",
    keywords: ["tabs", "limit", "max", "open", "performance", "editor"],
  },
];
