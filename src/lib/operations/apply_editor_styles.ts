import type { EditorSettings } from "$lib/types/editor_settings";

export function apply_editor_styles(settings: EditorSettings): void {
  const root = document.documentElement;
  const computed_styles = getComputedStyle(root);

  root.style.setProperty("--editor-font-size", `${settings.font_size}rem`);
  root.style.setProperty("--editor-line-height", `${settings.line_height}`);

  const heading_color_value =
    settings.heading_color === "inherit"
      ? computed_styles.getPropertyValue("--foreground").trim()
      : settings.heading_color === "primary"
        ? computed_styles.getPropertyValue("--primary").trim()
        : computed_styles.getPropertyValue("--accent-foreground").trim();

  root.style.setProperty("--editor-heading-color", heading_color_value);

  const spacing_map = {
    compact: "1rem",
    normal: "1.5rem",
    spacious: "2rem",
  };
  root.style.setProperty("--editor-spacing", spacing_map[settings.spacing]);
}
