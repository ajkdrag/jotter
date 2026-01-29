export type EditorSettings = {
  font_size: number;
  line_height: number;
  heading_color: "inherit" | "primary" | "accent";
  spacing: "compact" | "normal" | "spacious";
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  font_size: 1.0,
  line_height: 1.75,
  heading_color: "inherit",
  spacing: "normal",
};

export const SETTINGS_KEY = "editor" as const;
