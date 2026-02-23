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

export const SANS_FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "system-ui", label: "System UI" },
  { value: "SF Pro Display", label: "SF Pro" },
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "Roboto", label: "Roboto" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Arial", label: "Arial" },
  { value: "Lato", label: "Lato" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Source Sans 3", label: "Source Sans" },
];

export const MONO_FONT_OPTIONS = [
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "SF Mono", label: "SF Mono" },
  { value: "Cascadia Code", label: "Cascadia Code" },
  { value: "Source Code Pro", label: "Source Code Pro" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono" },
  { value: "Consolas", label: "Consolas" },
  { value: "Monaco", label: "Monaco" },
  { value: "Menlo", label: "Menlo" },
  { value: "ui-monospace", label: "System Mono" },
];

export const COLOR_PRESETS: { value: string; label: string; swatch: string }[] =
  [
    {
      value: "hsl(30, 5%, 30%)",
      label: "Warm Gray",
      swatch: "hsl(30, 5%, 30%)",
    },
    {
      value: "hsl(40, 8%, 15%)",
      label: "Charcoal",
      swatch: "hsl(40, 8%, 15%)",
    },
    { value: "hsl(35, 5%, 45%)", label: "Stone", swatch: "hsl(35, 5%, 45%)" },
    {
      value: "hsl(155, 40%, 35%)",
      label: "Spruce",
      swatch: "hsl(155, 40%, 35%)",
    },
    {
      value: "hsl(240, 30%, 35%)",
      label: "Indigo",
      swatch: "hsl(240, 30%, 35%)",
    },
    {
      value: "hsl(340, 45%, 40%)",
      label: "Rose",
      swatch: "hsl(340, 45%, 40%)",
    },
    {
      value: "hsl(190, 45%, 32%)",
      label: "Cyan",
      swatch: "hsl(190, 45%, 32%)",
    },
    { value: "hsl(25, 60%, 35%)", label: "Amber", swatch: "hsl(25, 60%, 35%)" },
    {
      value: "hsl(170, 40%, 38%)",
      label: "Teal",
      swatch: "hsl(170, 40%, 38%)",
    },
    { value: "hsl(45, 45%, 38%)", label: "Gold", swatch: "hsl(45, 45%, 38%)" },
    { value: "hsl(0, 0%, 95%)", label: "White", swatch: "hsl(0, 0%, 95%)" },
    { value: "hsl(0, 0%, 75%)", label: "Silver", swatch: "hsl(0, 0%, 75%)" },
  ];

export function resolve_font_stack(
  family: string,
  type: "sans" | "mono",
): string {
  const fallbacks =
    type === "sans"
      ? "system-ui, -apple-system, sans-serif"
      : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  return `"${family}", ${fallbacks}`;
}
