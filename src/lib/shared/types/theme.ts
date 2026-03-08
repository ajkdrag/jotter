export type ThemeColorScheme = "dark" | "light";

export type ThemeSpacing = "compact" | "normal" | "spacious";

export type ThemeHeadingColor = "inherit" | "primary" | "accent";

export type ThemeBoldStyle = "default" | "heavier" | "color-accent";

export type ThemeBlockquoteStyle = "default" | "minimal" | "accent-bar";

export type ThemeCodeBlockStyle = "default" | "borderless" | "filled";

export type Theme = {
  id: string;
  name: string;
  color_scheme: ThemeColorScheme;
  is_builtin: boolean;

  accent_hue: number;
  accent_chroma: number;
  font_family_sans: string;
  font_family_mono: string;

  font_size: number;
  line_height: number;
  paragraph_spacing: number;
  spacing: ThemeSpacing;
  heading_color: ThemeHeadingColor;
  heading_font_weight: number;
  heading_1_size: number;
  heading_2_size: number;
  heading_3_size: number;
  heading_4_size: number;
  heading_5_size: number;
  heading_6_size: number;

  editor_padding_x: number;
  editor_padding_y: number;

  bold_style: ThemeBoldStyle;
  blockquote_style: ThemeBlockquoteStyle;
  code_block_style: ThemeCodeBlockStyle;

  editor_text_color: string | null;
  bold_color: string | null;
  italic_color: string | null;
  link_color: string | null;
  blockquote_border_color: string | null;
  blockquote_text_color: string | null;
  blockquote_bg_color: string | null;
  code_block_bg: string | null;
  code_block_text_color: string | null;
  code_block_radius: number;
  inline_code_bg: string | null;
  inline_code_text_color: string | null;
  highlight_bg: string | null;
  highlight_text_color: string | null;
  selection_bg: string | null;
  caret_color: string | null;
  table_border_color: string | null;
  table_header_bg: string | null;
  table_cell_padding: number;

  token_overrides: Record<string, string>;
};

const SHARED_DEFAULTS: Omit<
  Theme,
  "id" | "name" | "color_scheme" | "is_builtin"
> = {
  accent_hue: 155,
  accent_chroma: 0.11,
  font_family_sans: "Inter",
  font_family_mono: "JetBrains Mono",
  font_size: 1.0,
  line_height: 1.75,
  paragraph_spacing: 1.5,
  spacing: "normal",
  heading_color: "inherit",
  heading_font_weight: 500,
  heading_1_size: 1.75,
  heading_2_size: 1.1875,
  heading_3_size: 1.125,
  heading_4_size: 1.0625,
  heading_5_size: 1.0,
  heading_6_size: 0.875,
  editor_padding_x: 2,
  editor_padding_y: 3,
  bold_style: "default",
  blockquote_style: "default",
  code_block_style: "default",
  editor_text_color: null,
  bold_color: null,
  italic_color: null,
  link_color: null,
  blockquote_border_color: null,
  blockquote_text_color: null,
  blockquote_bg_color: null,
  code_block_bg: null,
  code_block_text_color: null,
  code_block_radius: 0.75,
  inline_code_bg: null,
  inline_code_text_color: null,
  highlight_bg: null,
  highlight_text_color: null,
  selection_bg: null,
  caret_color: null,
  table_border_color: null,
  table_header_bg: null,
  table_cell_padding: 0.65,
  token_overrides: {},
};

export const BUILTIN_NORDIC_LIGHT: Theme = {
  id: "nordic-light",
  name: "Nordic Light",
  color_scheme: "light",
  is_builtin: true,
  ...SHARED_DEFAULTS,
};

export const BUILTIN_NORDIC_DARK: Theme = {
  id: "nordic-dark",
  name: "Nordic Dark",
  color_scheme: "dark",
  is_builtin: true,
  ...SHARED_DEFAULTS,
};

export const BUILTIN_THEMES: readonly Theme[] = [
  BUILTIN_NORDIC_LIGHT,
  BUILTIN_NORDIC_DARK,
];

export const DEFAULT_THEME_ID = "nordic-dark";

export function get_all_themes(user_themes: Theme[]): Theme[] {
  return [...BUILTIN_THEMES, ...user_themes];
}

export function resolve_theme(all_themes: Theme[], active_id: string): Theme {
  return all_themes.find((t) => t.id === active_id) ?? BUILTIN_NORDIC_DARK;
}

export function create_user_theme(name: string, base: Theme): Theme {
  return {
    ...base,
    id: crypto.randomUUID(),
    name,
    is_builtin: false,
  };
}
