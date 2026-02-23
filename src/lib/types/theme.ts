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
  spacing: ThemeSpacing;
  heading_color: ThemeHeadingColor;
  heading_font_weight: number;

  bold_style: ThemeBoldStyle;
  blockquote_style: ThemeBlockquoteStyle;
  code_block_style: ThemeCodeBlockStyle;

  editor_text_color: string | null;
  bold_color: string | null;
  italic_color: string | null;
  link_color: string | null;
  blockquote_border_color: string | null;
  blockquote_text_color: string | null;
  code_block_bg: string | null;
  code_block_text_color: string | null;
  inline_code_bg: string | null;
  inline_code_text_color: string | null;
  highlight_bg: string | null;
  highlight_text_color: string | null;

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
  spacing: "normal",
  heading_color: "inherit",
  heading_font_weight: 500,
  bold_style: "default",
  blockquote_style: "default",
  code_block_style: "default",
  editor_text_color: null,
  bold_color: null,
  italic_color: null,
  link_color: null,
  blockquote_border_color: null,
  blockquote_text_color: null,
  code_block_bg: null,
  code_block_text_color: null,
  inline_code_bg: null,
  inline_code_text_color: null,
  highlight_bg: null,
  highlight_text_color: null,
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
