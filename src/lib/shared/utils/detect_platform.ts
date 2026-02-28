export function detect_platform(): { is_tauri: boolean } {
  if (typeof window === "undefined") {
    return { is_tauri: false };
  }

  const is_tauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;

  return { is_tauri };
}

export const { is_tauri } = detect_platform();
