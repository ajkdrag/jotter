import type { EditorSettings } from "$lib/types/editor_settings";

export function apply_editor_styles(settings: EditorSettings): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement;

  root.style.setProperty("--editor-font-size", `${String(settings.font_size)}rem`);
  root.style.setProperty("--editor-line-height", String(settings.line_height));

  const heading_color_map = {
    inherit: "--foreground",
    primary: "--primary",
    accent: "--accent-foreground",
  };
  const color_var = heading_color_map[settings.heading_color];
  root.style.setProperty("--editor-heading-color", `var(${color_var})`);

  const spacing_map = {
    compact: "1rem",
    normal: "1.5rem",
    spacious: "2rem",
  };
  root.style.setProperty("--editor-spacing", spacing_map[settings.spacing]);
}
