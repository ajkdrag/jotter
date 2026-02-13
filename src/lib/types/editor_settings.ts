export type EditorSettings = {
  font_size: number;
  line_height: number;
  heading_color: "inherit" | "primary" | "accent";
  spacing: "compact" | "normal" | "spacious";
  link_syntax: "wikilink" | "markdown";
  attachment_folder: string;
  show_hidden_files: boolean;
  autosave_enabled: boolean;
  show_vault_dashboard_on_open: boolean;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  font_size: 1.0,
  line_height: 1.75,
  heading_color: "inherit",
  spacing: "normal",
  link_syntax: "wikilink",
  attachment_folder: ".assets",
  show_hidden_files: false,
  autosave_enabled: true,
  show_vault_dashboard_on_open: true,
};

export const SETTINGS_KEY = "editor" as const;
